import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { PaymentGatewayV1, MockERC20, ERC2771Forwarder } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('PaymentGatewayV1', function () {
  // Helper function to create server signature
  async function createServerSignature(
    signer: HardhatEthersSigner,
    gateway: PaymentGatewayV1,
    paymentId: string,
    tokenAddress: string,
    amount: bigint,
    recipientAddress: string,
    merchantId: string,
    feeBps: number
  ) {
    const domain = {
      name: 'SoloPayGateway',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await gateway.getAddress(),
    };

    const types = {
      PaymentRequest: [
        { name: 'paymentId', type: 'bytes32' },
        { name: 'tokenAddress', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'recipientAddress', type: 'address' },
        { name: 'merchantId', type: 'bytes32' },
        { name: 'feeBps', type: 'uint16' },
      ],
    };

    const message = {
      paymentId,
      tokenAddress,
      amount,
      recipientAddress,
      merchantId,
      feeBps,
    };

    return signer.signTypedData(domain, types, message);
  }

  // Helper function to create refund server signature
  async function createRefundSignature(
    signer: HardhatEthersSigner,
    gateway: PaymentGatewayV1,
    originalPaymentId: string,
    tokenAddress: string,
    amount: bigint,
    payerAddress: string,
    merchantId: string
  ) {
    const domain = {
      name: 'SoloPayGateway',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await gateway.getAddress(),
    };

    const types = {
      RefundRequest: [
        { name: 'originalPaymentId', type: 'bytes32' },
        { name: 'tokenAddress', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'payerAddress', type: 'address' },
        { name: 'merchantId', type: 'bytes32' },
      ],
    };

    const message = {
      originalPaymentId,
      tokenAddress,
      amount,
      payerAddress,
      merchantId,
    };

    return signer.signTypedData(domain, types, message);
  }

  // Test fixtures
  async function deployFixture() {
    const [owner, treasury, payer, other, signer, merchantRecipient] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory('MockERC20');
    const token = (await MockToken.deploy('Test Token', 'TEST', 18)) as unknown as MockERC20;
    await token.waitForDeployment();

    // Mint tokens to payer
    const mintAmount = ethers.parseEther('1000');
    await token.mint(payer.address, mintAmount);

    // Deploy ERC2771Forwarder
    const Forwarder = await ethers.getContractFactory('ERC2771Forwarder');
    const forwarder = (await Forwarder.deploy('SoloForwarder')) as unknown as ERC2771Forwarder;
    await forwarder.waitForDeployment();

    // Deploy PaymentGatewayV1 via proxy (owner, treasury, signer)
    const PaymentGateway = await ethers.getContractFactory('PaymentGatewayV1');
    const gateway = (await upgrades.deployProxy(
      PaymentGateway,
      [owner.address, treasury.address, signer.address],
      {
        kind: 'uups',
        initializer: 'initialize',
        constructorArgs: [await forwarder.getAddress()],
      }
    )) as unknown as PaymentGatewayV1;
    await gateway.waitForDeployment();

    // Create a test merchant ID
    const merchantId = ethers.id('MERCHANT_001');

    return {
      gateway,
      forwarder,
      token,
      owner,
      treasury,
      payer,
      other,
      signer,
      merchantRecipient,
      merchantId,
    };
  }

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);
      expect(await gateway.owner()).to.equal(owner.address);
    });

    it('Should set the correct trusted forwarder', async function () {
      const { gateway, forwarder } = await loadFixture(deployFixture);
      expect(await gateway.getTrustedForwarder()).to.equal(await forwarder.getAddress());
    });

    it('Should not enforce token whitelist by default', async function () {
      const { gateway } = await loadFixture(deployFixture);
      expect(await gateway.enforceTokenWhitelist()).to.equal(false);
    });

    it('Should set the correct server signer', async function () {
      const { gateway, signer } = await loadFixture(deployFixture);
      expect(await gateway.signerAddress()).to.equal(signer.address);
    });
  });

  describe('Direct Payment', function () {
    it('Should process payment successfully', async function () {
      const { gateway, token, treasury, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_001');
      const amount = ethers.parseEther('100');
      const feeBps = 0;

      // Create server signature
      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      // Approve token spending
      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Make payment
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      )
        .to.emit(gateway, 'PaymentCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          0n, // fee is 0
          (timestamp: bigint) => timestamp > 0n
        );

      expect(await gateway.processedPayments(paymentId)).to.equal(true);

      // Verify token transfer to recipient (no fee)
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(amount);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
    });

    it('Should reject duplicate payment ID', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_002');
      const amount = ethers.parseEther('50');
      const feeBps = 0;

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount * 2n);

      // First payment
      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          feeBps,
          signature
        );

      // Second payment with same ID should fail
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      ).to.be.revertedWith('PG: already processed');
    });

    it('Should reject zero amount', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_003');
      const feeBps = 0;

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        0n,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            0,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      ).to.be.revertedWith('PG: amount must be > 0');
    });

    it('Should reject zero token address', async function () {
      const { gateway, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_005');
      const amount = ethers.parseEther('10');
      const feeBps = 0;

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        ethers.ZeroAddress,
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            ethers.ZeroAddress,
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      ).to.be.revertedWith('PG: invalid token');
    });

    it('Should reject invalid signature', async function () {
      const { gateway, token, payer, other, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_INVALID_SIG');
      const amount = ethers.parseEther('10');
      const feeBps = 0;

      // Sign with wrong signer (other instead of signer)
      const signature = await createServerSignature(
        other,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      ).to.be.revertedWith('PG: invalid signature');
    });

    it('Should reject fee over 100%', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_HIGH_FEE');
      const amount = ethers.parseEther('10');
      const feeBps = 10001; // Over 100%

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      ).to.be.revertedWith('PG: fee too high');
    });
  });

  describe('Fee Mechanism', function () {
    it('Should split payment: fee to treasury, rest to recipient', async function () {
      const { gateway, token, treasury, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const feeBps = 500; // 5%

      const paymentId = ethers.id('FEE_ORDER_001');
      const amount = ethers.parseEther('100');

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      const expectedFee = (amount * BigInt(feeBps)) / 10000n;
      const expectedRecipientAmount = amount - expectedFee;

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      )
        .to.emit(gateway, 'PaymentCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          expectedFee,
          (timestamp: bigint) => timestamp > 0n
        );

      // Fee goes to treasury, rest to recipient
      expect(await token.balanceOf(treasury.address)).to.equal(expectedFee);
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(expectedRecipientAmount);
    });

    it('Should have zero fee when feeBps is 0', async function () {
      const { gateway, token, treasury, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('NO_FEE_ORDER');
      const amount = ethers.parseEther('100');
      const feeBps = 0;

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      )
        .to.emit(gateway, 'PaymentCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          0n, // fee is 0
          (timestamp: bigint) => timestamp > 0n
        );

      // Full amount goes to recipient, nothing to treasury
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(amount);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
    });
  });

  describe('Token Whitelist', function () {
    it('Should allow owner to set supported token', async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      await expect(gateway.connect(owner).setSupportedToken(await token.getAddress(), true))
        .to.emit(gateway, 'TokenSupportChanged')
        .withArgs(await token.getAddress(), true);

      expect(await gateway.supportedTokens(await token.getAddress())).to.equal(true);
    });

    it('Should reject non-owner setting supported token', async function () {
      const { gateway, token, other } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(other).setSupportedToken(await token.getAddress(), true)
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });

    it('Should enforce whitelist when enabled', async function () {
      const { gateway, token, payer, owner, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      // Enable whitelist enforcement
      await gateway.connect(owner).setEnforceTokenWhitelist(true);

      const paymentId = ethers.id('ORDER_006');
      const amount = ethers.parseEther('10');
      const feeBps = 0;

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Should fail - token not whitelisted
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      ).to.be.revertedWith('PG: token not supported');

      // Add token to whitelist
      await gateway.connect(owner).setSupportedToken(await token.getAddress(), true);

      // Now should succeed
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            feeBps,
            signature
          )
      ).to.emit(gateway, 'PaymentCompleted');
    });

    it('Should batch set supported tokens', async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      const tokens = [await token.getAddress(), ethers.Wallet.createRandom().address];
      const supported = [true, true];

      await gateway.connect(owner).batchSetSupportedTokens(tokens, supported);

      expect(await gateway.supportedTokens(tokens[0])).to.equal(true);
      expect(await gateway.supportedTokens(tokens[1])).to.equal(true);
    });
  });

  describe('Meta Transaction', function () {
    it('Should process meta-transaction via forwarder', async function () {
      const { gateway, forwarder, token, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('META_ORDER_001');
      const amount = ethers.parseEther('25');
      const feeBps = 0;

      // Create server signature
      const serverSignature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      // Approve token spending
      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Encode the pay function call
      const data = gateway.interface.encodeFunctionData('pay', [
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps,
        serverSignature,
      ]);

      // Get nonce for payer (OZ v5 format)
      const nonce = await forwarder.nonces(payer.address);
      const forwarderDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

      // Sign the request using EIP-712 (OZ v5 format - nonce is included in signing but not in struct)
      const domain = {
        name: 'SoloForwarder',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await forwarder.getAddress(),
      };

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      };

      const message = {
        from: payer.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        nonce: nonce,
        deadline: forwarderDeadline,
        data: data,
      };

      const forwarderSignature = await payer.signTypedData(domain, types, message);

      // OZ v5 ForwardRequestData struct (includes signature, excludes nonce)
      const requestData = {
        from: payer.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        deadline: forwarderDeadline,
        data: data,
        signature: forwarderSignature,
      };

      // Execute via forwarder (anyone can submit)
      await expect(forwarder.execute(requestData)).to.emit(gateway, 'PaymentCompleted');

      expect(await gateway.processedPayments(paymentId)).to.equal(true);
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(amount);
    });
  });

  describe('Upgrade', function () {
    it('Should allow owner to upgrade', async function () {
      const { gateway, forwarder } = await loadFixture(deployFixture);

      // Deploy V2 (same contract for testing)
      const PaymentGatewayV2 = await ethers.getContractFactory('PaymentGatewayV1');

      // This should not revert (constructorArgs needed for new implementation)
      await expect(
        upgrades.upgradeProxy(await gateway.getAddress(), PaymentGatewayV2, {
          kind: 'uups',
          constructorArgs: [await forwarder.getAddress()],
        })
      ).to.not.be.reverted;
    });

    it('Should reject non-owner upgrade', async function () {
      const { gateway, forwarder, other } = await loadFixture(deployFixture);

      const PaymentGatewayV2 = await ethers.getContractFactory('PaymentGatewayV1', other);

      await expect(
        upgrades.upgradeProxy(await gateway.getAddress(), PaymentGatewayV2, {
          kind: 'uups',
          constructorArgs: [await forwarder.getAddress()],
        })
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });
  });

  describe('View Functions', function () {
    it('Should return correct payment status', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('VIEW_ORDER_001');
      const amount = ethers.parseEther('10');
      const feeBps = 0;

      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(false);

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount);
      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          feeBps,
          signature
        );

      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(true);
    });

    it('Should return treasury address', async function () {
      const { gateway, treasury } = await loadFixture(deployFixture);

      expect(await gateway.treasuryAddress()).to.equal(treasury.address);
    });
  });

  describe('Admin Functions', function () {
    it('Should allow owner to set server signer', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      const newSigner = ethers.Wallet.createRandom().address;

      await expect(gateway.connect(owner).setSigner(newSigner))
        .to.emit(gateway, 'SignerChanged')
        .withArgs(await gateway.signerAddress(), newSigner);

      expect(await gateway.signerAddress()).to.equal(newSigner);
    });

    it('Should reject non-owner setting server signer', async function () {
      const { gateway, other } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(other).setSigner(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });

    it('Should reject zero address as server signer', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      await expect(gateway.connect(owner).setSigner(ethers.ZeroAddress)).to.be.revertedWith(
        'PG: invalid signer'
      );
    });

    it('Should allow owner to set treasury', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      const newTreasury = ethers.Wallet.createRandom().address;

      await expect(gateway.connect(owner).setTreasury(newTreasury))
        .to.emit(gateway, 'TreasuryChanged')
        .withArgs(await gateway.treasuryAddress(), newTreasury);

      expect(await gateway.treasuryAddress()).to.equal(newTreasury);
    });

    it('Should reject zero address as treasury', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      await expect(gateway.connect(owner).setTreasury(ethers.ZeroAddress)).to.be.revertedWith(
        'PG: invalid treasury'
      );
    });
  });

  describe('Refund', function () {
    // Helper to make a payment first (needed for refund tests)
    async function makePaymentFixture() {
      const fixture = await loadFixture(deployFixture);
      const { gateway, token, payer, signer, merchantRecipient, merchantId } = fixture;

      const paymentId = ethers.id('REFUND_TEST_PAYMENT');
      const amount = ethers.parseEther('100');
      const feeBps = 0;

      const signature = await createServerSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        feeBps
      );

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          feeBps,
          signature
        );

      return { ...fixture, paymentId, amount };
    }

    it('Should process refund successfully', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId, paymentId, amount } =
        await makePaymentFixture();

      // Merchant needs to approve the gateway to spend tokens for refund
      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount);

      // Note: merchantRecipient already has the tokens from the payment

      const refundSignature = await createRefundSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        payer.address,
        merchantId
      );

      const payerBalanceBefore = await token.balanceOf(payer.address);

      await expect(
        gateway
          .connect(merchantRecipient)
          .refund(
            paymentId,
            await token.getAddress(),
            amount,
            payer.address,
            merchantId,
            refundSignature
          )
      )
        .to.emit(gateway, 'RefundCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          (timestamp: bigint) => timestamp > 0n
        );

      // Verify refund status
      expect(await gateway.refundedPayments(paymentId)).to.equal(true);
      expect(await gateway.isPaymentRefunded(paymentId)).to.equal(true);

      // Verify payer received tokens back
      const payerBalanceAfter = await token.balanceOf(payer.address);
      expect(payerBalanceAfter - payerBalanceBefore).to.equal(amount);
    });

    it('Should reject refund for non-existent payment', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const nonExistentPaymentId = ethers.id('NON_EXISTENT_PAYMENT');
      const amount = ethers.parseEther('100');

      const refundSignature = await createRefundSignature(
        signer,
        gateway,
        nonExistentPaymentId,
        await token.getAddress(),
        amount,
        payer.address,
        merchantId
      );

      await expect(
        gateway
          .connect(merchantRecipient)
          .refund(
            nonExistentPaymentId,
            await token.getAddress(),
            amount,
            payer.address,
            merchantId,
            refundSignature
          )
      ).to.be.revertedWith('PG: payment not found');
    });

    it('Should reject duplicate refund', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId, paymentId, amount } =
        await makePaymentFixture();

      // Mint extra tokens to merchant for second refund attempt
      await token.mint(merchantRecipient.address, amount);
      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount * 2n);

      const refundSignature = await createRefundSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        payer.address,
        merchantId
      );

      // First refund should succeed
      await gateway
        .connect(merchantRecipient)
        .refund(
          paymentId,
          await token.getAddress(),
          amount,
          payer.address,
          merchantId,
          refundSignature
        );

      // Second refund should fail
      await expect(
        gateway
          .connect(merchantRecipient)
          .refund(
            paymentId,
            await token.getAddress(),
            amount,
            payer.address,
            merchantId,
            refundSignature
          )
      ).to.be.revertedWith('PG: already refunded');
    });

    it('Should reject refund with invalid signature', async function () {
      const { gateway, token, payer, other, merchantRecipient, merchantId, paymentId, amount } =
        await makePaymentFixture();

      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount);

      // Sign with wrong signer
      const refundSignature = await createRefundSignature(
        other,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        payer.address,
        merchantId
      );

      await expect(
        gateway
          .connect(merchantRecipient)
          .refund(
            paymentId,
            await token.getAddress(),
            amount,
            payer.address,
            merchantId,
            refundSignature
          )
      ).to.be.revertedWith('PG: invalid signature');
    });

    it('Should reject refund with zero amount', async function () {
      const { gateway, token, payer, signer, merchantRecipient, merchantId, paymentId } =
        await makePaymentFixture();

      const refundSignature = await createRefundSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        0n,
        payer.address,
        merchantId
      );

      await expect(
        gateway
          .connect(merchantRecipient)
          .refund(
            paymentId,
            await token.getAddress(),
            0,
            payer.address,
            merchantId,
            refundSignature
          )
      ).to.be.revertedWith('PG: amount must be > 0');
    });

    it('Should reject refund with zero token address', async function () {
      const { gateway, payer, signer, merchantRecipient, merchantId, paymentId, amount } =
        await makePaymentFixture();

      const refundSignature = await createRefundSignature(
        signer,
        gateway,
        paymentId,
        ethers.ZeroAddress,
        amount,
        payer.address,
        merchantId
      );

      await expect(
        gateway
          .connect(merchantRecipient)
          .refund(paymentId, ethers.ZeroAddress, amount, payer.address, merchantId, refundSignature)
      ).to.be.revertedWith('PG: invalid token');
    });

    it('Should reject refund with zero payer address', async function () {
      const { gateway, token, signer, merchantRecipient, merchantId, paymentId, amount } =
        await makePaymentFixture();

      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount);

      const refundSignature = await createRefundSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        ethers.ZeroAddress,
        merchantId
      );

      await expect(
        gateway
          .connect(merchantRecipient)
          .refund(
            paymentId,
            await token.getAddress(),
            amount,
            ethers.ZeroAddress,
            merchantId,
            refundSignature
          )
      ).to.be.revertedWith('PG: invalid payer');
    });

    it('Should work with meta-transaction for refund', async function () {
      const {
        gateway,
        forwarder,
        token,
        payer,
        signer,
        merchantRecipient,
        merchantId,
        paymentId,
        amount,
      } = await makePaymentFixture();

      // Merchant approves gateway
      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount);

      const refundSignature = await createRefundSignature(
        signer,
        gateway,
        paymentId,
        await token.getAddress(),
        amount,
        payer.address,
        merchantId
      );

      // Encode the refund function call
      const data = gateway.interface.encodeFunctionData('refund', [
        paymentId,
        await token.getAddress(),
        amount,
        payer.address,
        merchantId,
        refundSignature,
      ]);

      // Get nonce for merchant
      const nonce = await forwarder.nonces(merchantRecipient.address);
      const forwarderDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Sign the forward request
      const domain = {
        name: 'SoloForwarder',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await forwarder.getAddress(),
      };

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      };

      const message = {
        from: merchantRecipient.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        nonce: nonce,
        deadline: forwarderDeadline,
        data: data,
      };

      const forwarderSignature = await merchantRecipient.signTypedData(domain, types, message);

      const requestData = {
        from: merchantRecipient.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        deadline: forwarderDeadline,
        data: data,
        signature: forwarderSignature,
      };

      const payerBalanceBefore = await token.balanceOf(payer.address);

      // Execute via forwarder
      await expect(forwarder.execute(requestData)).to.emit(gateway, 'RefundCompleted');

      // Verify refund
      expect(await gateway.isPaymentRefunded(paymentId)).to.equal(true);
      const payerBalanceAfter = await token.balanceOf(payer.address);
      expect(payerBalanceAfter - payerBalanceBefore).to.equal(amount);
    });
  });
});

// Mock ERC20 contract for testing
describe('MockERC20', function () {
  // This is just to ensure the mock is available
});

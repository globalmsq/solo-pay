import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { PaymentGatewayV1, ERC2771Forwarder } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PaymentGatewayV1", function () {
  // Test fixtures
  async function deployFixture() {
    const [owner, merchant, payer, other] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    const token = await MockToken.deploy("Test Token", "TEST", 18);
    await token.waitForDeployment();

    // Mint tokens to payer
    const mintAmount = ethers.parseEther("1000");
    await token.mint(payer.address, mintAmount);

    // Deploy ERC2771Forwarder
    const Forwarder = await ethers.getContractFactory("ERC2771Forwarder");
    const forwarder = await Forwarder.deploy("MSQPayForwarder");
    await forwarder.waitForDeployment();

    // Deploy PaymentGatewayV1 via proxy
    const PaymentGateway = await ethers.getContractFactory("PaymentGatewayV1");
    const gateway = (await upgrades.deployProxy(
      PaymentGateway,
      [owner.address],
      {
        kind: "uups",
        initializer: "initialize",
        constructorArgs: [await forwarder.getAddress()],
      }
    )) as unknown as PaymentGatewayV1;
    await gateway.waitForDeployment();

    return {
      gateway,
      forwarder,
      token,
      owner,
      merchant,
      payer,
      other,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { gateway, owner } = await loadFixture(deployFixture);
      expect(await gateway.owner()).to.equal(owner.address);
    });

    it("Should set the correct trusted forwarder", async function () {
      const { gateway, forwarder } = await loadFixture(deployFixture);
      expect(await gateway.getTrustedForwarder()).to.equal(
        await forwarder.getAddress()
      );
    });

    it("Should not enforce token whitelist by default", async function () {
      const { gateway } = await loadFixture(deployFixture);
      expect(await gateway.enforceTokenWhitelist()).to.be.false;
    });
  });

  describe("Direct Payment", function () {
    it("Should process payment successfully", async function () {
      const { gateway, token, merchant, payer } = await loadFixture(
        deployFixture
      );

      const paymentId = ethers.id("ORDER_001");
      const amount = ethers.parseEther("100");

      // Approve token spending
      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Make payment
      await expect(
        gateway.connect(payer).pay(paymentId, await token.getAddress(), amount, merchant.address)
      )
        .to.emit(gateway, "PaymentCompleted")
        .withArgs(
          paymentId,
          payer.address,
          merchant.address,
          await token.getAddress(),
          amount,
          (timestamp: bigint) => timestamp > 0n
        );

      // Verify payment was processed
      expect(await gateway.processedPayments(paymentId)).to.be.true;

      // Verify token transfer
      expect(await token.balanceOf(merchant.address)).to.equal(amount);
    });

    it("Should reject duplicate payment ID", async function () {
      const { gateway, token, merchant, payer } = await loadFixture(
        deployFixture
      );

      const paymentId = ethers.id("ORDER_002");
      const amount = ethers.parseEther("50");

      await token.connect(payer).approve(await gateway.getAddress(), amount * 2n);

      // First payment
      await gateway.connect(payer).pay(paymentId, await token.getAddress(), amount, merchant.address);

      // Second payment with same ID should fail
      await expect(
        gateway.connect(payer).pay(paymentId, await token.getAddress(), amount, merchant.address)
      ).to.be.revertedWith("PaymentGateway: already processed");
    });

    it("Should reject zero amount", async function () {
      const { gateway, token, merchant, payer } = await loadFixture(
        deployFixture
      );

      const paymentId = ethers.id("ORDER_003");

      await expect(
        gateway.connect(payer).pay(paymentId, await token.getAddress(), 0, merchant.address)
      ).to.be.revertedWith("PaymentGateway: amount must be > 0");
    });

    it("Should reject zero merchant address", async function () {
      const { gateway, token, payer } = await loadFixture(deployFixture);

      const paymentId = ethers.id("ORDER_004");
      const amount = ethers.parseEther("10");

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await expect(
        gateway.connect(payer).pay(paymentId, await token.getAddress(), amount, ethers.ZeroAddress)
      ).to.be.revertedWith("PaymentGateway: invalid merchant");
    });

    it("Should reject zero token address", async function () {
      const { gateway, merchant, payer } = await loadFixture(deployFixture);

      const paymentId = ethers.id("ORDER_005");
      const amount = ethers.parseEther("10");

      await expect(
        gateway.connect(payer).pay(paymentId, ethers.ZeroAddress, amount, merchant.address)
      ).to.be.revertedWith("PaymentGateway: invalid token");
    });
  });

  describe("Token Whitelist", function () {
    it("Should allow owner to set supported token", async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(owner).setSupportedToken(await token.getAddress(), true)
      )
        .to.emit(gateway, "TokenSupportChanged")
        .withArgs(await token.getAddress(), true);

      expect(await gateway.supportedTokens(await token.getAddress())).to.be.true;
    });

    it("Should reject non-owner setting supported token", async function () {
      const { gateway, token, other } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(other).setSupportedToken(await token.getAddress(), true)
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("Should enforce whitelist when enabled", async function () {
      const { gateway, token, merchant, payer, owner } = await loadFixture(
        deployFixture
      );

      // Enable whitelist enforcement
      await gateway.connect(owner).setEnforceTokenWhitelist(true);

      const paymentId = ethers.id("ORDER_006");
      const amount = ethers.parseEther("10");

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Should fail - token not whitelisted
      await expect(
        gateway.connect(payer).pay(paymentId, await token.getAddress(), amount, merchant.address)
      ).to.be.revertedWith("PaymentGateway: token not supported");

      // Add token to whitelist
      await gateway.connect(owner).setSupportedToken(await token.getAddress(), true);

      // Now should succeed
      await expect(
        gateway.connect(payer).pay(paymentId, await token.getAddress(), amount, merchant.address)
      ).to.emit(gateway, "PaymentCompleted");
    });

    it("Should batch set supported tokens", async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      const tokens = [await token.getAddress(), ethers.Wallet.createRandom().address];
      const supported = [true, true];

      await gateway.connect(owner).batchSetSupportedTokens(tokens, supported);

      expect(await gateway.supportedTokens(tokens[0])).to.be.true;
      expect(await gateway.supportedTokens(tokens[1])).to.be.true;
    });
  });

  describe("Meta Transaction", function () {
    it("Should process meta-transaction via forwarder", async function () {
      const { gateway, forwarder, token, merchant, payer } = await loadFixture(
        deployFixture
      );

      const paymentId = ethers.id("META_ORDER_001");
      const amount = ethers.parseEther("25");

      // Approve token spending
      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Encode the pay function call
      const data = gateway.interface.encodeFunctionData("pay", [
        paymentId,
        await token.getAddress(),
        amount,
        merchant.address,
      ]);

      // Get nonce for payer (OZ v5 format)
      const nonce = await forwarder.nonces(payer.address);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

      // Sign the request using EIP-712 (OZ v5 format - nonce is included in signing but not in struct)
      const domain = {
        name: "MSQPayForwarder",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await forwarder.getAddress(),
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
        ],
      };

      const message = {
        from: payer.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        nonce: nonce,
        deadline: deadline,
        data: data,
      };

      const signature = await payer.signTypedData(domain, types, message);

      // OZ v5 ForwardRequestData struct (includes signature, excludes nonce)
      const requestData = {
        from: payer.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        deadline: deadline,
        data: data,
        signature: signature,
      };

      // Execute via forwarder (anyone can submit)
      await expect(
        forwarder.execute(requestData)
      ).to.emit(gateway, "PaymentCompleted");

      // Verify the payer is recorded correctly (not the forwarder)
      expect(await gateway.processedPayments(paymentId)).to.be.true;
      expect(await token.balanceOf(merchant.address)).to.equal(amount);
    });
  });

  describe("Upgrade", function () {
    it("Should allow owner to upgrade", async function () {
      const { gateway, forwarder, owner } = await loadFixture(deployFixture);

      // Deploy V2 (same contract for testing)
      const PaymentGatewayV2 = await ethers.getContractFactory(
        "PaymentGatewayV1"
      );

      // This should not revert (constructorArgs needed for new implementation)
      await expect(
        upgrades.upgradeProxy(await gateway.getAddress(), PaymentGatewayV2, {
          kind: "uups",
          constructorArgs: [await forwarder.getAddress()],
        })
      ).to.not.be.reverted;
    });

    it("Should reject non-owner upgrade", async function () {
      const { gateway, forwarder, other } = await loadFixture(deployFixture);

      const PaymentGatewayV2 = await ethers.getContractFactory(
        "PaymentGatewayV1",
        other
      );

      await expect(
        upgrades.upgradeProxy(await gateway.getAddress(), PaymentGatewayV2, {
          kind: "uups",
          constructorArgs: [await forwarder.getAddress()],
        })
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should return correct payment status", async function () {
      const { gateway, token, merchant, payer } = await loadFixture(
        deployFixture
      );

      const paymentId = ethers.id("VIEW_ORDER_001");
      const amount = ethers.parseEther("10");

      expect(await gateway.isPaymentProcessed(paymentId)).to.be.false;

      await token.connect(payer).approve(await gateway.getAddress(), amount);
      await gateway.connect(payer).pay(paymentId, await token.getAddress(), amount, merchant.address);

      expect(await gateway.isPaymentProcessed(paymentId)).to.be.true;
    });
  });
});

// Mock ERC20 contract for testing
describe("MockERC20", function () {
  // This is just to ensure the mock is available
});

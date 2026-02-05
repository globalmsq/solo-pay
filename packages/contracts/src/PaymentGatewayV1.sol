// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPaymentGateway} from "./interfaces/IPaymentGateway.sol";

/**
 * @title PaymentGatewayV1
 * @author MSQ Team
 * @notice Multi-service blockchain payment gateway supporting direct and meta-transactions
 * @dev Uses UUPS proxy pattern for upgradeability and ERC2771 for meta-transaction support
 *
 * Features:
 * - Direct payments where users pay their own gas
 * - Meta-transactions via ERC2771 trusted forwarder (gasless for users)
 * - Server signature verification for payment authorization
 * - Fee deduction to treasury
 * - Duplicate payment prevention via paymentId tracking
 * - Optional token whitelist support
 *
 * @custom:security-contact security@msq.io
 */
contract PaymentGatewayV1 is
    UUPSUpgradeable,
    OwnableUpgradeable,
    ERC2771ContextUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    IPaymentGateway
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    /// @notice EIP-712 typehash for PaymentRequest
    /// @dev keccak256("PaymentRequest(bytes32 paymentId,address tokenAddress,uint256 amount,address recipientAddress,bytes32 merchantId,uint16 feeBps)")
    bytes32 public constant PAYMENT_REQUEST_TYPEHASH = 0x72d781e0942cb269e920d3563ab7d2adea5c28bad1c9364c70dcb529638cff65;

    /// @notice Maximum fee percentage (100% = 10000 basis points)
    uint16 public constant MAX_FEE_BPS = 10000;

    /// @notice Mapping of payment IDs to their processed status
    mapping(bytes32 => bool) public processedPayments;

    /// @notice Mapping of token addresses to their supported status
    mapping(address => bool) public supportedTokens;

    /// @notice Whether token whitelist is enforced
    bool public enforceTokenWhitelist;

    /// @notice Address of the treasury
    address public treasuryAddress;

    /// @notice Address of the server signer for payment authorization
    address public signerAddress;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarderAddress) ERC2771ContextUpgradeable(trustedForwarderAddress) {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param owner Address of the contract owner
     * @param treasury Address of the treasury
     * @param signer Address of the server signer for payment authorization
     */
    function initialize(address owner, address treasury, address signer) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(owner);
        __ReentrancyGuard_init();
        __EIP712_init("SoloPayGateway", "1");

        enforceTokenWhitelist = false;
        _setTreasury(treasury);
        _setSigner(signer);
    }

    /**
     * @notice Internal function to set treasury address
     * @dev Emits TreasuryChanged event
     * @param newTreasuryAddress The new treasury address
     */
    function _setTreasury(address newTreasuryAddress) internal {
        require(newTreasuryAddress != address(0), "PG: invalid treasury");
        address oldTreasuryAddress = treasuryAddress;
        treasuryAddress = newTreasuryAddress;
        emit TreasuryChanged(oldTreasuryAddress, newTreasuryAddress);
    }

    /**
     * @notice Set the treasury address
     * @dev Only callable by owner
     * @param newTreasuryAddress The new treasury address
     */
    function setTreasury(address newTreasuryAddress) external onlyOwner {
        _setTreasury(newTreasuryAddress);
    }

    /**
     * @notice Internal function to set server signer address
     * @dev Emits SignerChanged event
     * @param newSigner The new server signer address
     */
    function _setSigner(address newSigner) internal {
        require(newSigner != address(0), "PG: invalid signer");
        address oldSigner = signerAddress;
        signerAddress = newSigner;
        emit SignerChanged(oldSigner, newSigner);
    }

    /**
     * @notice Set the server signer address
     * @dev Only callable by owner
     * @param newSigner The new server signer address
     */
    function setSigner(address newSigner) external onlyOwner {
        _setSigner(newSigner);
    }

    /**
     * @notice Process a payment with server signature verification
     * @dev Transfers ERC20 tokens from the payer: fee to treasury, rest to recipient
     *      Uses _msgSender() to support both direct calls and meta-transactions
     * @param paymentId Unique identifier for this payment (should be hash of order ID)
     * @param tokenAddress Address of the ERC20 token to transfer
     * @param amount Amount to transfer (in token's smallest unit)
     * @param recipientAddress Address to receive the payment (merchant's wallet)
     * @param merchantId Merchant identifier (from server signature)
     * @param feeBps Fee percentage in basis points (from server signature)
     * @param serverSignature Server's EIP-712 signature
     */
    function pay(
        bytes32 paymentId,
        address tokenAddress,
        uint256 amount,
        address recipientAddress,
        bytes32 merchantId,
        uint16 feeBps,
        bytes calldata serverSignature
    ) external nonReentrant {
        _processPayment(paymentId, tokenAddress, amount, recipientAddress, merchantId, feeBps, serverSignature, _msgSender());
    }

    /**
     * @notice Internal function to verify server signature
     * @param paymentId Payment identifier
     * @param tokenAddress Token address
     * @param amount Payment amount
     * @param recipientAddress Recipient address
     * @param merchantId Merchant identifier
     * @param feeBps Fee in basis points
     * @param signature Server signature
     * @return True if signature is valid
     */
    function _verifyServerSignature(
        bytes32 paymentId,
        address tokenAddress,
        uint256 amount,
        address recipientAddress,
        bytes32 merchantId,
        uint16 feeBps,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                PAYMENT_REQUEST_TYPEHASH,
                paymentId,
                tokenAddress,
                amount,
                recipientAddress,
                merchantId,
                feeBps
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = hash.recover(signature);

        return recoveredSigner == signerAddress;
    }

    /**
     * @notice Internal function to process payment
     * @dev Validates inputs, verifies signature, calculates fee, transfers tokens, emits event
     * @param paymentId Unique payment identifier
     * @param tokenAddress Token address
     * @param amount Payment amount
     * @param recipientAddress Recipient address (merchant's wallet)
     * @param merchantId Merchant identifier
     * @param feeBps Fee in basis points (from server signature)
     * @param serverSignature Server signature
     * @param payerAddress Address of the payer
     */
    function _processPayment(
        bytes32 paymentId,
        address tokenAddress,
        uint256 amount,
        address recipientAddress,
        bytes32 merchantId,
        uint16 feeBps,
        bytes calldata serverSignature,
        address payerAddress
    ) internal {
        // Validation
        require(treasuryAddress != address(0), "PG: treasury not set");
        require(signerAddress != address(0), "PG: signer not set");
        require(!processedPayments[paymentId], "PG: already processed");
        require(amount > 0, "PG: amount must be > 0");
        require(tokenAddress != address(0), "PG: invalid token");
        require(recipientAddress != address(0), "PG: invalid recipient");
        require(feeBps <= MAX_FEE_BPS, "PG: fee too high");

        // Verify server signature
        require(
            _verifyServerSignature(paymentId, tokenAddress, amount, recipientAddress, merchantId, feeBps, serverSignature),
            "PG: invalid signature"
        );

        // Check token whitelist if enforced
        if (enforceTokenWhitelist) {
            require(supportedTokens[tokenAddress], "PG: token not supported");
        }

        // Calculate fee
        uint256 feeAmount = (amount * feeBps) / MAX_FEE_BPS;
        uint256 recipientAmount = amount - feeAmount;

        // Mark as processed before transfer (reentrancy protection)
        processedPayments[paymentId] = true;

        // Transfer fee to treasury (if any)
        if (feeAmount > 0) {
            IERC20(tokenAddress).safeTransferFrom(payerAddress, treasuryAddress, feeAmount);
        }

        // Transfer remaining amount to recipient
        IERC20(tokenAddress).safeTransferFrom(payerAddress, recipientAddress, recipientAmount);

        // Emit event
        emit PaymentCompleted(
            paymentId,
            merchantId,
            payerAddress,
            recipientAddress,
            tokenAddress,
            amount,
            feeAmount,
            block.timestamp
        );
    }

    /**
     * @notice Set whether a token is supported
     * @dev Only callable by owner
     * @param tokenAddress The token address
     * @param supported Whether the token should be supported
     */
    function setSupportedToken(
        address tokenAddress,
        bool supported
    ) external onlyOwner {
        require(tokenAddress != address(0), "PG: invalid token");
        supportedTokens[tokenAddress] = supported;
        emit TokenSupportChanged(tokenAddress, supported);
    }

    /**
     * @notice Set whether token whitelist is enforced
     * @dev Only callable by owner
     * @param enforce Whether to enforce the whitelist
     */
    function setEnforceTokenWhitelist(bool enforce) external onlyOwner {
        enforceTokenWhitelist = enforce;
    }

    /**
     * @notice Batch set supported tokens
     * @dev Only callable by owner, useful for initial setup
     * @param tokenAddresses Array of token addresses
     * @param supported Array of support statuses
     */
    function batchSetSupportedTokens(
        address[] calldata tokenAddresses,
        bool[] calldata supported
    ) external onlyOwner {
        require(tokenAddresses.length == supported.length, "PG: length mismatch");

        for (uint256 i = 0; i < tokenAddresses.length; ++i) {
            require(tokenAddresses[i] != address(0), "PG: invalid token");
            supportedTokens[tokenAddresses[i]] = supported[i];
            emit TokenSupportChanged(tokenAddresses[i], supported[i]);
        }
    }

    /**
     * @notice Check if a payment ID has been used
     * @param paymentId The payment ID to check
     * @return True if the payment has been processed
     */
    function isPaymentProcessed(bytes32 paymentId) external view returns (bool) {
        return processedPayments[paymentId];
    }

    /**
     * @notice Get the trusted forwarder address
     * @return Address of the trusted forwarder
     */
    function getTrustedForwarder() external view returns (address) {
        return trustedForwarder();
    }

    /**
     * @notice Get the EIP-712 domain separator
     * @return The domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============ ERC2771 Overrides ============

    /**
     * @dev Override _msgSender to support meta-transactions
     */
    function _msgSender()
        internal
        view
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    /**
     * @dev Override _msgData to support meta-transactions
     */
    function _msgData()
        internal
        view
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771ContextUpgradeable._msgData();
    }

    /**
     * @dev Override _contextSuffixLength for ERC2771
     */
    function _contextSuffixLength()
        internal
        view
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (uint256)
    {
        return ERC2771ContextUpgradeable._contextSuffixLength();
    }

    // ============ UUPS Override ============

    /**
     * @dev Authorize contract upgrade (only owner)
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}

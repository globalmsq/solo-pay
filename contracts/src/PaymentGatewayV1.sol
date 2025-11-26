// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPaymentGateway} from "./interfaces/IPaymentGateway.sol";

/**
 * @title PaymentGatewayV1
 * @notice Multi-service blockchain payment gateway supporting direct and meta-transactions
 * @dev Uses UUPS proxy pattern for upgradeability and ERC2771 for meta-transaction support
 *
 * Features:
 * - Direct payments where users pay their own gas
 * - Meta-transactions via ERC2771 trusted forwarder (gasless for users)
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
    IPaymentGateway
{
    using SafeERC20 for IERC20;

    /// @notice Mapping of payment IDs to their processed status
    mapping(bytes32 => bool) public processedPayments;

    /// @notice Mapping of token addresses to their supported status
    mapping(address => bool) public supportedTokens;

    /// @notice Whether token whitelist is enforced
    bool public enforceTokenWhitelist;

    /// @dev Reserved storage gap for future upgrades
    uint256[47] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param owner Address of the contract owner
     */
    function initialize(address owner) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(owner);
        __ReentrancyGuard_init();

        enforceTokenWhitelist = false;
    }

    /**
     * @notice Process a payment
     * @dev Transfers ERC20 tokens from the payer to the merchant
     *      Uses _msgSender() to support both direct calls and meta-transactions
     * @param paymentId Unique identifier for this payment (should be hash of order ID)
     * @param token Address of the ERC20 token to transfer
     * @param amount Amount to transfer (in token's smallest unit)
     * @param merchant Address to receive the payment
     */
    function pay(
        bytes32 paymentId,
        address token,
        uint256 amount,
        address merchant
    ) external nonReentrant {
        _processPayment(paymentId, token, amount, merchant, _msgSender());
    }

    /**
     * @dev Internal function to process payment
     * @param paymentId Unique payment identifier
     * @param token Token address
     * @param amount Payment amount
     * @param merchant Recipient address
     * @param payer Address of the payer
     */
    function _processPayment(
        bytes32 paymentId,
        address token,
        uint256 amount,
        address merchant,
        address payer
    ) internal {
        // Validation
        require(!processedPayments[paymentId], "PaymentGateway: already processed");
        require(amount > 0, "PaymentGateway: amount must be > 0");
        require(merchant != address(0), "PaymentGateway: invalid merchant");
        require(token != address(0), "PaymentGateway: invalid token");

        // Check token whitelist if enforced
        if (enforceTokenWhitelist) {
            require(supportedTokens[token], "PaymentGateway: token not supported");
        }

        // Mark as processed before transfer (reentrancy protection)
        processedPayments[paymentId] = true;

        // Transfer tokens from payer to merchant
        IERC20(token).safeTransferFrom(payer, merchant, amount);

        // Emit event
        emit PaymentCompleted(
            paymentId,
            payer,
            merchant,
            token,
            amount,
            block.timestamp
        );
    }

    /**
     * @notice Set whether a token is supported
     * @dev Only callable by owner
     * @param token The token address
     * @param supported Whether the token should be supported
     */
    function setSupportedToken(
        address token,
        bool supported
    ) external onlyOwner {
        require(token != address(0), "PaymentGateway: invalid token");
        supportedTokens[token] = supported;
        emit TokenSupportChanged(token, supported);
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
     * @param tokens Array of token addresses
     * @param supported Array of support statuses
     */
    function batchSetSupportedTokens(
        address[] calldata tokens,
        bool[] calldata supported
    ) external onlyOwner {
        require(tokens.length == supported.length, "PaymentGateway: length mismatch");

        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "PaymentGateway: invalid token");
            supportedTokens[tokens[i]] = supported[i];
            emit TokenSupportChanged(tokens[i], supported[i]);
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

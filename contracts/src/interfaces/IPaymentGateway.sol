// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPaymentGateway
 * @notice Interface for the PaymentGateway contract
 */
interface IPaymentGateway {
    /**
     * @notice Emitted when a payment is completed
     * @param paymentId Unique identifier for the payment
     * @param payer Address of the user who paid
     * @param merchant Address of the recipient
     * @param token Address of the ERC20 token used
     * @param amount Amount transferred
     * @param timestamp Block timestamp when payment was processed
     */
    event PaymentCompleted(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed merchant,
        address token,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when token support status changes
     * @param token Address of the token
     * @param supported Whether the token is now supported
     */
    event TokenSupportChanged(address indexed token, bool supported);

    /**
     * @notice Process a direct payment (user pays gas)
     * @param paymentId Unique identifier for this payment
     * @param token Address of the ERC20 token to transfer
     * @param amount Amount to transfer (in token's smallest unit)
     * @param merchant Address to receive the payment
     */
    function pay(
        bytes32 paymentId,
        address token,
        uint256 amount,
        address merchant
    ) external;

    /**
     * @notice Check if a payment has been processed
     * @param paymentId The payment ID to check
     * @return True if the payment has been processed
     */
    function processedPayments(bytes32 paymentId) external view returns (bool);

    /**
     * @notice Check if a token is supported
     * @param token The token address to check
     * @return True if the token is supported
     */
    function supportedTokens(address token) external view returns (bool);

    /**
     * @notice Set whether a token is supported (admin only)
     * @param token The token address
     * @param supported Whether the token should be supported
     */
    function setSupportedToken(address token, bool supported) external;
}

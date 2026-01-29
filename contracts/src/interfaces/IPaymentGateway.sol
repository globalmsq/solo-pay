// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPaymentGateway
 * @author MSQ Team
 * @notice Interface for the PaymentGateway contract
 */
interface IPaymentGateway {
    /**
     * @notice Event emitted when the treasury address is changed
     * @param oldTreasuryAddress Previous treasury address
     * @param newTreasuryAddress New treasury address
     */
    event TreasuryChanged(address indexed oldTreasuryAddress, address indexed newTreasuryAddress);

    /**
     * @notice Emitted when a payment is completed
     * @param paymentId Unique identifier for the payment
     * @param merchantId Merchant identifier (from server signature)
     * @param payerAddress Address of the user who paid
     * @param recipientAddress Address that received the payment (merchant's wallet)
     * @param tokenAddress Address of the ERC20 token used
     * @param amount Total amount transferred
     * @param fee Fee amount (sent to treasury)
     * @param timestamp Block timestamp when payment was processed
     */
    event PaymentCompleted(
        bytes32 indexed paymentId,
        bytes32 indexed merchantId,
        address indexed payerAddress,
        address recipientAddress,
        address tokenAddress,
        uint256 amount,
        uint256 fee,
        uint256 timestamp
    );

    /**
     * @notice Emitted when token support status changes
     * @param tokenAddress Address of the token
     * @param supported Whether the token is now supported
     */
    event TokenSupportChanged(address indexed tokenAddress, bool indexed supported);

    /**
     * @notice Emitted when server signer is changed
     * @param oldSigner Previous signer address
     * @param newSigner New signer address
     */
    event SignerChanged(address indexed oldSigner, address indexed newSigner);

    /**
     * @notice Process a payment with server signature verification
     * @param paymentId Unique identifier for this payment
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
    ) external;

    /**
     * @notice Check if a payment has been processed
     * @param paymentId The payment ID to check
     * @return True if the payment has been processed
     */
    function processedPayments(bytes32 paymentId) external view returns (bool);

    /**
     * @notice Check if a token is supported
     * @param tokenAddress The token address to check
     * @return True if the token is supported
     */
    function supportedTokens(address tokenAddress) external view returns (bool);

    /**
     * @notice Set whether a token is supported (admin only)
     * @param tokenAddress The token address
     * @param supported Whether the token should be supported
     */
    function setSupportedToken(address tokenAddress, bool supported) external;
}

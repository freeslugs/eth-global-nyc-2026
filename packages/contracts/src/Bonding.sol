// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Bonding
/// @notice Stake bonds behind attestations; slash on proven misbehavior.
/// @dev Skeleton: economics are intentionally minimal. Slashing disputes are
///      out of scope for the scaffold.
contract Bonding {
    mapping(address => uint256) public bondOf;
    uint256 public totalBonded;

    /// @dev Placeholder authority allowed to slash. 0x0 = open (skeleton).
    address public slasher;

    event Staked(address indexed who, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed who, uint256 amount, uint256 newBalance);
    event Slashed(address indexed who, uint256 amount, address indexed beneficiary);

    error InsufficientBond();
    error NotSlasher();

    constructor(address slasher_) {
        slasher = slasher_;
    }

    modifier onlySlasher() {
        if (slasher != address(0) && msg.sender != slasher) {
            revert NotSlasher();
        }
        _;
    }

    function stake() external payable {
        bondOf[msg.sender] += msg.value;
        totalBonded += msg.value;
        emit Staked(msg.sender, msg.value, bondOf[msg.sender]);
    }

    function withdraw(uint256 amount) external {
        if (amount > bondOf[msg.sender]) revert InsufficientBond();
        bondOf[msg.sender] -= amount;
        totalBonded -= amount;
        emit Withdrawn(msg.sender, amount, bondOf[msg.sender]);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }

    function slash(address who, uint256 amount, address beneficiary) external onlySlasher {
        if (amount > bondOf[who]) revert InsufficientBond();
        bondOf[who] -= amount;
        totalBonded -= amount;
        emit Slashed(who, amount, beneficiary);
        (bool ok, ) = beneficiary.call{value: amount}("");
        require(ok, "transfer failed");
    }
}

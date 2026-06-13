// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubmissionRegistry} from "../src/SubmissionRegistry.sol";

contract SubmissionRegistryTest is Test {
    SubmissionRegistry internal registry;

    uint256 internal constant FEE = 0.01 ether;
    bytes32 internal constant NODE = keccak256("weather.acme.safeskills.eth");
    string internal constant PIN = "sha256:abc123";
    string internal constant URI = "ipfs://bafyclean";

    address internal org = address(0xA11CE);

    event SubmissionPaid(
        bytes32 indexed node,
        string pin,
        string fetchUri,
        bool isPrivate,
        address indexed submitter
    );

    function setUp() public {
        registry = new SubmissionRegistry(FEE);
        vm.deal(org, 1 ether);
    }

    function test_EmitsSubmissionPaidWithCorrectArgs() public {
        vm.expectEmit(true, true, true, true);
        emit SubmissionPaid(NODE, PIN, URI, false, org);

        vm.prank(org);
        registry.submit{value: FEE}(NODE, PIN, URI, false);
    }

    function test_AcceptsOverpayment() public {
        vm.prank(org);
        registry.submit{value: FEE + 1 wei}(NODE, PIN, URI, true);
        assertEq(address(registry).balance, FEE + 1 wei);
    }

    function test_RevertsWhenFeeTooLow() public {
        vm.prank(org);
        vm.expectRevert(
            abi.encodeWithSelector(SubmissionRegistry.InsufficientFee.selector, FEE - 1, FEE)
        );
        registry.submit{value: FEE - 1}(NODE, PIN, URI, false);
    }

    function test_OwnerCanWithdraw() public {
        vm.prank(org);
        registry.submit{value: FEE}(NODE, PIN, URI, false);

        uint256 before = address(this).balance;
        registry.withdraw();
        assertEq(address(this).balance, before + FEE);
    }

    function test_NonOwnerCannotWithdraw() public {
        vm.prank(org);
        vm.expectRevert(SubmissionRegistry.NotOwner.selector);
        registry.withdraw();
    }

    receive() external payable {}
}

const { ethers } = require("hardhat");
var fs = require('fs');
const { readFileSync } = require('fs');
const governanceContract = require("../../artifacts/contracts/governance/GovernanceProtocol.sol/GovernanceProtocol.json");
const supplierProcessContract = require("../../artifacts/contracts/SupplierProcess.sol/SupplierProcess.json");
const question = require("./cli_questions");

const proposalsFileInfo = process.env.proposalsFileInfo;
const proposalsFile = process.env.proposalsFile;
const SERVICE_FUNC = process.env.SERVICE_FUNC;
const API_KEY = process.env.API_KEY;
const GOVERNANCE_CONTRACT_ADDRESS = process.env.GOVERNANCE_PROTOCOL_CONTRACT_ADDRESS;
const SUPPLIER_CONTRACT_ADDRESS = process.env.SUPPLIER_CONTRACT_ADDRESS;

async function boardProposeService(functionToCall) {
    // User's Input data
    const PRIVATE_KEY = await question.caller_private_key();
    const caller_address = await question.caller_address_request();
    const supplier_name = await question.supplier_name_request();
    const contest_name = await question.contest_name_request();
    const proposal_description = await question.proposal_description_request();

    // Provider - Alchemy
    const alchemyProvider = new ethers.providers.AlchemyProvider("goerli", API_KEY);
    // Signer
    const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);
    // Contracts Instances
    const governanceProtocolContract = new ethers.Contract(GOVERNANCE_CONTRACT_ADDRESS, governanceContract.abi, signer);
    const supplierProcessServiceContract = new ethers.Contract(SUPPLIER_CONTRACT_ADDRESS, supplierProcessContract.abi, signer);

    const encodedFunctionCall = supplierProcessServiceContract.interface.encodeFunctionData(functionToCall, [supplier_name, caller_address]);

    console.log("_______________________________________________________________________________________\n")
    console.log(`Proposing Function: ${functionToCall} on ${supplierProcessServiceContract.address} from Supplier: ${[supplier_name]}`)
    console.log(`Service Proposal Description:\n  ${proposal_description}`)
    console.log(`Recruitment Contest Identifier:\n  ${contest_name}\n`)

    const proposeTx = await governanceProtocolContract.supplierPropose(
        [supplierProcessServiceContract.address],
        [0],
        [encodedFunctionCall],
        proposal_description,
        contest_name
    );

    const proposeReceipt = await proposeTx.wait();
    const proposalId = proposeReceipt.events[0].args.proposalId;
    console.log(`\nProposed with proposal ID:\n  ${proposalId}`);

    const proposalState = await governanceProtocolContract.state(proposalId);
    const proposalSnapShot = await governanceProtocolContract.proposalSnapshot(proposalId);
    const proposalDeadline = await governanceProtocolContract.proposalDeadline(proposalId);
    const proposalIndex = await governanceProtocolContract.retrieveProposalIndex();

    // Save Proposal in JSON file
    let proposals = JSON.parse(fs.readFileSync(proposalsFile, "utf8"));
    proposals["goerli"].push(proposalId.toString());
    fs.writeFileSync(proposalsFile, JSON.stringify(proposals, null, 2));

    let proposalsInfo = JSON.parse(readFileSync(proposalsFileInfo, "utf8"));
    proposalsInfo["goerli"].push("ID: " + proposalId.toString(),
        ["Index: " + proposalIndex.toString(), "Function: " + SERVICE_FUNC.toString(),
        "Caller Address: " + caller_address.toString(), "Supplier Name: " + supplier_name.toString(),
        "Service Description: " + proposal_description.toString()]);
    fs.writeFileSync(proposalsFileInfo, JSON.stringify(proposalsInfo, null, 2));

    // The state of the proposal. 1 is not passed. 0 is passed.
    console.log(`\nCurrent Proposal State: ${proposalState}`);
    // What block # the proposal was snapshot
    console.log(`Current Proposal Snapshot: ${proposalSnapShot}`);
    // The block number the proposal voting expires
    console.log(`Current Proposal Deadline: ${proposalDeadline}`);
};

boardProposeService(SERVICE_FUNC)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    });
require("dotenv").config();
const BigNumber = require("bignumber.js");
const LIT = "0xfd0205066521550D7d7AB19DA8F72bb004b4C341";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";

// web3
const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const MULTICALL_ABI = [
  // https://github.com/mds1/multicall
  "function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)",
];
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];
const lit = new ethers.Contract(LIT, ERC20_ABI, provider);
const multicall = new ethers.Contract(MULTICALL, MULTICALL_ABI, provider);

// express
const express = require("express");
const PORT = process.env.PORT || 5000;
const app = express();

app.get("/total-supply", async (req, res) => {
  const totalSupply = new BigNumber((await lit.totalSupply()).toString()).div(
    1e18
  );
  res.send(totalSupply.toFixed());
});

app.get("/circulating-supply", async (req, res) => {
  const toBalance = (hex) => new BigNumber(hex).div(1e18);

  const deductAddresses = [
    "0x9a8FEe232DCF73060Af348a1B62Cdb0a19852d13", // gov multisig
    "0x7Bf66285d9C4Fc6C1f4BE3A26b13BA0e1d62428E", // veMPH staking
    "0x01FD4e4FaA1D14feAD5aFD13CeaA86Cbdb60Cc4D", // llamapay vesting below
    "0x2904D3Ed8d05587951210626746AfA64CbA31e59",
    "0xb30dC83cE066F900459eC155B69807ce4b86eD96",
    "0xeF2cECa07B90372Fd405b3C7657087eF4c74cAA6",
    "0x4b3AD4853981F652728C956054bD4FD7629bC914",
    "0xD005E11bF456873d99fABa528e4D1400A21678eE",
    "0x46eB84FC87C50036FF6B0DFDD2F0DC706306756e",
    "0x315dC7a07Bf4C178E8cc54d88a1AEC9F84b14612",
    "0xff333a0670A1f6480a7053a5745c86D9fC4698FF",
    "0x340010D340976E6901275aa53e6554f2E0849B1c",
    "0xBD2F44E03CF83b992BC0F4C739158e39D5bD6dFF",
    "0xb9683733593E6340AdE9B091C99A90dAa2358165",
    "0x94bd6a7bc92eD843FaF13706BFd410B2B8619670",
  ];

  const calls = [];
  calls.push([LIT, (await lit.populateTransaction.totalSupply()).data]);
  for (const address of deductAddresses) {
    calls.push([LIT, (await lit.populateTransaction.balanceOf(address)).data]);
  }

  const result = await multicall.callStatic.aggregate(calls);

  let supply = toBalance(result.returnData[0]);
  for (let i = 1; i < result.returnData.length; i++) {
    supply = supply.minus(toBalance(result.returnData[i]));
  }

  res.send(supply.toFixed());
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

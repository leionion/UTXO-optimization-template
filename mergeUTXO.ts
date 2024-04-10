import { getUtxos, pushBTCpmt } from "./utils/utxo";
import { Wallet } from "./utils/wallet";
import * as Bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";

Bitcoin.initEccLib(ecc);

const COUNT = 2;
const SIGNATURE_SIZE = 126;
const TESTNET_FEERATE = 1;

const main = async () => {
  const wallet = new Wallet();
  let value = 0;

  const utxos = await getUtxos(wallet.address);

  const psbt = new Bitcoin.Psbt({ network: Bitcoin.networks.testnet });

  for (let i = 0; i < COUNT; i++) {
    psbt.addInput({
      hash: utxos[i].txid,
      index: utxos[i].vout,
      witnessUtxo: {
        value: utxos[i].value,
        script: wallet.output,
      },
      tapInternalKey: Buffer.from(wallet.publicKey, "hex").slice(1, 33),
    });

    value += utxos[i].value;
  }

  const fee = calculateTxFee(psbt, TESTNET_FEERATE);

  psbt.addOutput({
    address: wallet.address,
    value: value - fee,
  });
  const signedPsbt = wallet.signPsbt(psbt);

  const tx = signedPsbt.extractTransaction();
  const txHex = tx.toHex();

  const txId = await pushBTCpmt(txHex);

  console.log(`Successfully merged. Txid:${txId}`);
};

const calculateTxFee = (psbt: Bitcoin.Psbt, feeRate: number): number => {
  const MOCK_OUTPUT_SCRIPT = Buffer.from(
    "51205db24348a5b6602bad8ff20b80749b09c53f87799b2c8f4e1aa3fedd5d6e0db2",
    "hex"
  );
  const MOCK_OUTPUT_VALUE = 546;

  const tx = new Bitcoin.Transaction();

  for (let i = 0; i < psbt.txInputs.length; i++) {
    const txInput = psbt.txInputs[i];

    tx.addInput(txInput.hash, txInput.index, txInput.sequence);
    tx.setWitness(i, [Buffer.alloc(SIGNATURE_SIZE)]);
  }

  for (let txOutput of psbt.txOutputs) {
    tx.addOutput(txOutput.script, txOutput.value);
  }
  tx.addOutput(MOCK_OUTPUT_SCRIPT, MOCK_OUTPUT_VALUE);

  return tx.virtualSize() * feeRate;
};

main();

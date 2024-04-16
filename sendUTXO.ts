import { getUtxos, pushBTCpmt } from "./utils/utxo";
import { Wallet } from "./utils/wallet";
import * as Bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";

Bitcoin.initEccLib(ecc);

const INITIAL_FEE = 1000;
const SIGNATURE_SIZE = 126;
const TESTNET_FEERATE = 1


const main = async (sendToAddress: string) => {
    const wallet = new Wallet();

    console.log('address', wallet.address)

    const utxos = await getUtxos(wallet.address);

    const utxo = utxos.find((utxo) => utxo.value > 10000);

    if (utxo === undefined) throw new Error("No btcs");

    const psbt = new Bitcoin.Psbt({ network: Bitcoin.networks.testnet });

    psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
            value: utxo.value,
            script: wallet.output,
        },
        tapInternalKey: Buffer.from(wallet.publicKey, "hex").slice(1, 33),
    });

    psbt.addOutput({
        address: sendToAddress,
        value: utxo.value - INITIAL_FEE,
    });

    const fee = calculateTxFee(psbt, TESTNET_FEERATE)

    psbt.addOutput({
        address: wallet.address,
        value: INITIAL_FEE - fee,
    });

    const signedPsbt = wallet.signPsbt(psbt);

    const tx = signedPsbt.extractTransaction();
    const txHex = tx.toHex();

    const txId = await pushBTCpmt(txHex);

    console.log(`Successfully Sent. Txid : ${txId}`)
};

const calculateTxFee = (psbt: Bitcoin.Psbt, feeRate: number): number => {
    const tx = new Bitcoin.Transaction();

    for (let i = 0; i < psbt.txInputs.length; i++) {
        const txInput = psbt.txInputs[i];

        tx.addInput(txInput.hash, txInput.index, txInput.sequence);
        tx.setWitness(i, [Buffer.alloc(SIGNATURE_SIZE)]);
    }

    for (let txOutput of psbt.txOutputs) {
        tx.addOutput(txOutput.script, txOutput.value);
    }
    tx.addOutput(psbt.txOutputs[0].script, psbt.txOutputs[0].value);

    return tx.virtualSize() * feeRate;
};

main('tb1q5dnjrhckptrt8evf0s0042ppv9szkyrz0h642v');

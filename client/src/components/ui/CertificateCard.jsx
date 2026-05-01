import React, { useState } from "react";
import { Award, CheckCircle, Download, Link as LinkIcon } from "lucide-react";
import { ethers } from "ethers";
import { useTheme } from "@/context/ThemeContext";
import { getPrimaryButtonClasses } from "@/utils/themeUtils";

// Minimal ABI for your Certificate Smart Contract
const CERTIFICATE_ABI = [
  "function mintCertificate(address to, string memory tokenURI) public returns (uint256)",
];

const CertificateCard = ({ cert, onDownload, web3Config, onMintSuccess }) => {
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState(cert.txHash || null);
  const { appTheme } = useTheme();

  const handleMintNFT = async () => {
    // Check if the user has a Web3 wallet (e.g., MetaMask) installed
    if (!window.ethereum) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Please install MetaMask to mint certificates! 🦊",
        }),
      );
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setIsMinting(true);
    try {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Requesting wallet connection... 🔗",
        }),
      );

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = accounts[0];

      if (!web3Config?.polygonContractAddress) {
        throw new Error("Smart contract address not configured by Admin.");
      }

      // Connect to the injected Web3 provider (MetaMask)
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        web3Config.polygonContractAddress,
        CERTIFICATE_ABI,
        signer,
      );

      const metadataUri =
        cert.ipfsMetadataUri || `ipfs://default-cert-uri/${cert._id}`;

      const tx = await contract.mintCertificate(account, metadataUri);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Transaction submitted. Waiting for confirmation... ⏳",
        }),
      );

      await tx.wait(); // Wait for the transaction to be mined
      setTxHash(tx.hash);
      if (onMintSuccess) onMintSuccess(cert._id, tx.hash);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Certificate successfully minted to Polygon Network! ✨",
        }),
      );
    } catch (error) {
      console.error(error);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Minting cancelled or failed. ❌",
        }),
      );
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="relative bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group overflow-hidden flex flex-col h-full text-inherit">
      <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        <Award className="w-32 h-32 text-green-600" />
      </div>
      <div className="flex items-start justify-between relative z-10 mb-2">
        <div className="flex items-center gap-4 mb-3">
          <div className="bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-full text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-inherit leading-tight pr-4 text-lg">
              {cert.title}
            </h3>
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100/80 w-max px-2 py-0.5 rounded-full border border-emerald-200 mt-1.5 shadow-sm">
              <CheckCircle className="w-3 h-3" /> Verified Credential
            </span>
          </div>
        </div>
      </div>
      <div className="mt-auto relative z-10 flex flex-col flex-grow">
        <p className="text-sm text-inherit opacity-90 mb-5 font-medium leading-relaxed bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/20 shadow-inner">
          {cert.material?.description ||
            "Awarded for outstanding academic achievement and active participation."}
        </p>
        <div className="flex items-center justify-between mt-auto pt-1">
          <p className="text-xs opacity-70 font-bold tracking-wide uppercase">
            Issued:{" "}
            {new Date(cert.createdAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <div className="flex gap-2">
            {web3Config?.web3Enabled && !txHash && (
              <button
                onClick={handleMintNFT}
                disabled={isMinting}
                className={`flex items-center gap-1.5 px-3 py-2 disabled:opacity-50 text-sm font-bold rounded-lg hover:shadow-md transition-all active:scale-95 z-20 ${getPrimaryButtonClasses(appTheme)}`}
              >
                {isMinting ? (
                  <div
                    className="loader"
                    style={{ "--s": "12px", "--g": "2px" }}
                  />
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" /> Mint NFT
                  </>
                )}
              </button>
            )}
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-sm font-bold rounded-lg hover:bg-purple-500/30 transition-all z-20"
              >
                <CheckCircle className="w-4 h-4" /> View on Chain
              </a>
            )}
            <button
              onClick={() => onDownload(cert._id, cert.title)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 hover:shadow-md transition-all active:scale-95 z-20"
            >
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateCard;

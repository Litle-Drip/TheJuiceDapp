import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { ethers } from 'ethers';
import { NETWORKS, ABI_V1, ABI_V2, type NetworkKey } from './contracts';

interface WalletState {
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  address: string;
  connected: boolean;
  network: NetworkKey;
  ethUsd: number;
  feeBps: number;
  connecting: boolean;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  switchNetwork: () => void;
  getV1Contract: (readOnly?: boolean) => ethers.Contract | null;
  getV2Contract: (readOnly?: boolean) => ethers.Contract | null;
  shortAddress: string;
  explorerUrl: string;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be inside WalletProvider');
  return ctx;
}

function getEth() {
  const eth = (window as any).ethereum;
  if (!eth) return null;
  if (eth.providers?.length) {
    const mm = eth.providers.find((p: any) => p.isMetaMask);
    return mm || eth.providers[0];
  }
  return eth;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    provider: null,
    signer: null,
    address: '',
    connected: false,
    network: 'mainnet',
    ethUsd: 3500,
    feeBps: 250,
    connecting: false,
  });

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/eth-price');
        const data = await res.json();
        if (data?.ethereum?.usd) {
          setState(s => ({ ...s, ethUsd: data.ethereum.usd }));
        }
      } catch {
        // fallback price
      }
    };
    fetchPrice();
    const iv = setInterval(fetchPrice, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const eth = getEth();
    if (!eth) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(s => ({ ...s, connected: false, signer: null, provider: null, address: '' }));
      } else if (state.connected) {
        const provider = new ethers.BrowserProvider(eth);
        provider.getSigner().then(async (signer) => {
          const address = await signer.getAddress();
          setState(s => ({ ...s, provider, signer, address }));
        }).catch(() => {
          setState(s => ({ ...s, connected: false, signer: null, provider: null, address: '' }));
        });
      }
    };
    const handleChainChanged = () => {
      setState(s => ({ ...s, connected: false, signer: null, provider: null, address: '' }));
    };
    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);
    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [state.connected]);

  const net = NETWORKS[state.network];

  const ensureBase = useCallback(async () => {
    const eth = getEth();
    if (!eth) throw new Error('No wallet found');
    const chain = await eth.request({ method: 'eth_chainId' });
    if (BigInt(chain) !== BigInt(net.idHex)) {
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: net.idHex }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: net.idHex,
              chainName: net.chainName,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [net.rpc],
              blockExplorerUrls: [net.explorer],
            }],
          });
        } else throw e;
      }
    }
  }, [net]);

  const connect = useCallback(async () => {
    setState(s => ({ ...s, connecting: true }));
    try {
      await ensureBase();
      const eth = getEth();
      if (!eth) throw new Error('Install MetaMask or Coinbase Wallet');
      await eth.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      let feeBps = 250;
      try {
        const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
        const c = new ethers.Contract(net.contract, ABI_V1, rpcProvider);
        feeBps = Number(await c.protocolFeeBps());
      } catch {}

      setState(s => ({
        ...s,
        provider,
        signer,
        address,
        connected: true,
        connecting: false,
        feeBps,
      }));
    } catch (e) {
      setState(s => ({ ...s, connecting: false }));
      throw e;
    }
  }, [ensureBase, net]);

  const switchNetwork = useCallback(() => {
    setState(s => ({
      ...s,
      network: s.network === 'mainnet' ? 'testnet' : 'mainnet',
      connected: false,
      signer: null,
      provider: null,
      address: '',
    }));
  }, []);

  const getV1Contract = useCallback((readOnly = false) => {
    if (!net.contract) return null;
    if (readOnly) {
      const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
      return new ethers.Contract(net.contract, ABI_V1, rpcProvider);
    }
    if (!state.signer) return null;
    return new ethers.Contract(net.contract, ABI_V1, state.signer);
  }, [net, state.signer]);

  const getV2Contract = useCallback((readOnly = false) => {
    if (!net.v2contract) return null;
    if (readOnly) {
      const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
      return new ethers.Contract(net.v2contract, ABI_V2, rpcProvider);
    }
    if (!state.signer) return null;
    return new ethers.Contract(net.v2contract, ABI_V2, state.signer);
  }, [net, state.signer]);

  const shortAddress = state.address
    ? `${state.address.slice(0, 6)}...${state.address.slice(-4)}`
    : '';

  const explorerUrl = net.explorer;

  return (
    <WalletContext.Provider value={{
      ...state,
      connect,
      switchNetwork,
      getV1Contract,
      getV2Contract,
      shortAddress,
      explorerUrl,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

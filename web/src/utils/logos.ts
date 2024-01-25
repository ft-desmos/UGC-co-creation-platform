import DesmosLogo from '@/assets/desmos-logo.svg';
import WalletConnectLogo from '@/assets/dpm-logo.svg';
import KeplrLogo from '@/assets/keplr-logo.png';
import { ChainType, WalletType } from '@/wallets';

export const ChainLogos: Record<ChainType, string> = {
  [ChainType.Desmos]: DesmosLogo,
};

export const WalletLogos: Record<WalletType, string> = {
  [WalletType.WalletConnectDPM]: WalletConnectLogo,
  [WalletType.Keplr]: KeplrLogo,
};

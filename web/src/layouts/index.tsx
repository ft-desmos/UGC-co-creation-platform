import Header from '@/components/Header/Header';
import LoginConfirmModal from '@/components/LoginConfirmModal/LoginConfirmModal';
import WalletModal from '@/components/WalletModal/WalletModal';
import useWalletCallback from '@/hooks/useWalletCallback';
import { isChapterPage, isStoryPage } from '@/utils/regExp';
import { ChainType } from '@/wallets';
import { useLocation } from '@@/exports';
import { GlobalScrollbar } from 'mac-scrollbar';
import 'mac-scrollbar/dist/mac-scrollbar.css';
import { createContext, useEffect, useState } from 'react';
import { Outlet, useModel } from 'umi';

export interface WalletContextType {
  openWalletModal: () => void;
  confirmLogin: (
    chainType: ChainType,
    callbacks?: {
      onConfirm?: (token: string) => void;
      onReject?: () => void;
    },
  ) => Promise<string | undefined>;
}

export const WalletContext = createContext<WalletContextType>({
  openWalletModal: () => {},
  confirmLogin: async (chainType) => {
    return undefined;
  },
});

export default function Layout() {
  const location = useLocation();
  const { pathname, search } = location;
  useWalletCallback({ search });

  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [loginState, setLoginState] = useState<
    | {
        chainType: ChainType;
        onConfirm: (token: string) => void;
        onReject: () => void;
      }
    | undefined
  >();

  const { setChainType, setStoryId, setChapterId } = useModel(
    'storyModel',
    (model) => ({
      setChainType: model.setChainType,
      setStoryId: model.setStoryId,
      setChapterId: model.setChapterId,
    }),
  );
  const { getTokenAsync, connectedWallets } = useModel(
    'walletModel',
    (model) => ({
      getTokenAsync: model.getTokenAsync,
      connectedWallets: model.connectedWallets,
    }),
  );

  useEffect(() => {
    if (!isStoryPage(pathname) && !isChapterPage(pathname)) {
      setChainType(undefined);
      setStoryId('');
      setChapterId(0);
    }
  }, [pathname]);

  return (
    <WalletContext.Provider
      value={{
        openWalletModal: () => setWalletModalVisible(true),
        confirmLogin: (chainType, callbacks) => {
          return new Promise<string | undefined>((resolve) => {
            const wallet = connectedWallets[chainType];
            if (wallet.noSignature) {
              getTokenAsync(chainType, true).then((token: string) => {
                callbacks?.onConfirm?.(token);
                resolve(token);
              });
            } else {
              setLoginState({
                chainType,
                onConfirm: (token) => {
                  setLoginState(undefined);
                  callbacks?.onConfirm?.(token);
                  resolve(token);
                },
                onReject: () => {
                  setLoginState(undefined);
                  callbacks?.onReject?.();
                  resolve(undefined);
                },
              });
            }
          });
        },
      }}
    >
      <Header />
      <WalletModal
        visible={walletModalVisible}
        onClose={() => setWalletModalVisible(false)}
      />
      <LoginConfirmModal loginState={loginState} />
      <div style={{ height: 32 }} />
      <Outlet />
      <GlobalScrollbar />
    </WalletContext.Provider>
  );
}

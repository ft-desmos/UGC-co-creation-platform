import { shortenAccount } from '@/utils/format';
import { copy } from '@/utils/utils';
import { ChainType } from '@/wallets';
import {
  DisconnectOutlined,
  DownloadOutlined,
  LinkOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useRequest } from 'ahooks';
import {
  Avatar,
  Button,
  Col,
  Divider,
  Modal,
  Row,
  Spin,
  Tag,
  Tooltip,
} from 'antd';
import { useEffect } from 'react';
import { useIntl, useModel } from 'umi';
import styles from './WalletModal.less';

interface WalletModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function WalletModal({ visible, onClose }: WalletModalProps) {
  const {
    chainWallets,
    connectedWallets,
    accounts,
    connect,
    connecting,
    disconnect,
  } = useModel('walletModel');

  const { formatMessage } = useIntl();

  const { profiles, profileLoading, refreshProfile } = useModel('profileModel');

  const { data: walletAvailable } = useRequest(
    async () => {
      if (!chainWallets) return [];
      const available: boolean[][] = [];
      for (const chains of chainWallets) {
        const _available = [];
        for (const wallet of chains.wallets) {
          _available.push(await wallet.provider.isAvailable());
        }
        available.push(_available);
      }
      return available;
    },
    {
      refreshDeps: [chainWallets],
    },
  );

  useEffect(() => {
    refreshProfile();
  }, [visible]);

  return (
    <Modal
      closable={false}
      centered={true}
      open={visible}
      onCancel={() => {
        if (!connecting) {
          onClose();
        }
      }}
      footer={null}
      width={400}
      zIndex={1010}
    >
      <Spin spinning={connecting}>
        <Row justify={'space-evenly'} gutter={[12, 12]}>
          {Object.keys(connectedWallets).map((chainType) => {
            const wallet = connectedWallets[chainType as ChainType];
            const account = accounts[chainType as ChainType];
            return wallet ? (
              <Col span={8} key={chainType}>
                <div className={styles.currentWalletCol}>
                  <img className={styles.currentWalletIcon} src={wallet.icon} />
                  <Tooltip title={account}>
                    <div
                      className={styles.currentWalletAddress}
                      onClick={() => copy(account)}
                    >
                      {wallet.noShortenAccount
                        ? account
                        : shortenAccount(account)}
                    </div>
                  </Tooltip>
                  <DisconnectOutlined
                    className={styles.disconnectIcon}
                    onClick={() => disconnect(chainType as ChainType)}
                  />
                </div>
              </Col>
            ) : undefined;
          })}
        </Row>

        {!!profiles && (
          <Spin spinning={profileLoading}>
            <Divider style={{ marginTop: 0 }}>Desmos Profiles</Divider>
            {!profileLoading && profiles.length === 0 && (
              <div style={{ textAlign: 'center' }}>
                <Button
                  icon={<UserAddOutlined />}
                  rel="noreferrer noopener"
                  target="_blank"
                  href={'https://dpm.desmos.network/'}
                >
                  {formatMessage({ id: 'profile.create-profile' })}
                </Button>
              </div>
            )}
            {profiles.map((p, index) => (
              <div key={`profile-${index}`} className={styles.profileCard}>
                <Avatar src={p.profile_pic} />
                <div className={styles.nickname}>{p.nickname}</div>
                <Tag>{p.dtag}</Tag>
              </div>
            ))}
          </Spin>
        )}

        {!connectedWallets[ChainType.Desmos] &&
          chainWallets.map(({ icon, wallets, chainType }, chainIdx) => (
            <div className={styles.chain} key={chainType}>
              <Divider>
                <img className={styles.chainIcon} src={icon} />
              </Divider>
              {wallets.map((wallet, walletIdx) => (
                <div
                  key={wallet.name}
                  className={styles.walletCard}
                  onClick={() => {
                    connect(wallet.walletType);
                  }}
                >
                  <img className={styles.walletIcon} src={wallet.icon} />
                  <div className={styles.walletName}>{wallet.name}</div>
                  {!walletAvailable?.[chainIdx]?.[walletIdx] ? (
                    <DownloadOutlined className={styles.rightIcon} />
                  ) : connectedWallets[chainType]?.walletType ===
                    wallet.walletType ? (
                    <LinkOutlined className={styles.rightIcon} />
                  ) : null}
                </div>
              ))}
            </div>
          ))}
      </Spin>
    </Modal>
  );
}

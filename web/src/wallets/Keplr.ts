import {
  ChainType,
  WalletAutoConnectType,
  WalletEvents,
  WalletProvider,
  WalletType,
} from '@/wallets/index';

import { makeSignDoc } from '@cosmjs/amino';
import {
  assertIsDeliverTxSuccess,
  DesmosChains,
  DesmosClient,
  GasPrice,
  SigningMode,
} from '@desmoslabs/desmjs';
import { KeplrSigner } from '@desmoslabs/desmjs-keplr';
import { ReplySetting } from '@desmoslabs/desmjs-types/desmos/posts/v3/models';
import {
  MsgCreatePost,
  MsgEditPost,
} from '@desmoslabs/desmjs-types/desmos/posts/v3/msgs';
import {
  MsgCreatePostEncodeObject,
  MsgCreatePostTypeUrl,
  MsgEditPostEncodeObject,
  MsgEditPostTypeUrl,
} from '@desmoslabs/desmjs/build/modules/posts/v3';
import { Keplr } from '@keplr-wallet/types';
import BigNumber from 'bignumber.js';
import Long from 'long';

const ChainInfo =
  process.env.NODE_ENV === 'production'
    ? {
      denom: 'udsm',
      chainId: 'desmos-mainnet',
      rpcEndpoint: 'https://rpc.mainnet.desmos.network',
      chainInfo: DesmosChains.mainnet,
      subspaceId: 23,
    }
    : {
      denom: 'udaric',
      chainId: 'morpheus-apollo-3',
      rpcEndpoint: 'https://rpc.morpheus.desmos.network:443',
      chainInfo: DesmosChains.testnet,
      subspaceId: 24,
    };

export class KeplrWalletProvider implements WalletProvider {
  providerType: WalletType = WalletType.Keplr;
  chainType: ChainType = ChainType.Desmos;
  provider: Keplr | undefined;
  factoryAddress: string = '';
  findsMintAddress: string = '';

  subspaceName = 'FindTruman - UGCEditor';
  signer: KeplrSigner | undefined;
  client: DesmosClient | undefined;
  address = '';

  onConnect?: (payload: { address: string; pubKey?: string }) => void;
  onDisconnect?: () => void;

  constructor(
    { onConnect, onDisconnect, onAccountChanged, onChainChanged }: WalletEvents,
    factoryAddress: string,
    findsMintAddress: string,
  ) {
    this.factoryAddress = factoryAddress;
    this.findsMintAddress = findsMintAddress;
    this.getKeplr().then((keplr: any) => {
      if (keplr) {
        this.provider = keplr;
        this.onConnect = onConnect || (() => {});
        this.onDisconnect = onDisconnect || (() => {});
        window.addEventListener('keplr_keystorechange', () => {
          window.location.reload();
        });
      }
    });
  }

  async getKeplr() {
    if (window.keplr) {
      return window.keplr;
    }

    if (document.readyState === 'complete') {
      return window.keplr;
    }

    return new Promise((resolve) => {
      const documentStateChange = (event: Event) => {
        if (
          event.target &&
          (event.target as Document).readyState === 'complete'
        ) {
          resolve(window.keplr);
          document.removeEventListener('readystatechange', documentStateChange);
        }
      };

      document.addEventListener('readystatechange', documentStateChange);
    });
  }

  getProvider<PT>(): PT | undefined {
    return window.keplr as any;
  }

  async isAvailable(): Promise<boolean> {
    const keplr = await this.getKeplr();
    return !!keplr;
  }

  openWebsite() {
    window.open(
      'https://www.keplr.app/download',
      '_blank',
      'noreferrer noopener',
    );
  }

  setAutoConnect(autoConnect: WalletAutoConnectType) {
    localStorage.setItem('KEPLR_AUTO_CONNECT', autoConnect);
  }

  getAutoConnect(): boolean {
    const storage = localStorage.getItem('KEPLR_AUTO_CONNECT');
    return storage ? storage === WalletAutoConnectType.True : false;
  }

  async connect() {
    if (!this.provider) return;

    this.signer = new KeplrSigner(this.provider as any, {
      signingMode: SigningMode.DIRECT,
      chainInfo: ChainInfo.chainInfo,
    });
    await this.signer.connect();
    this.client = await DesmosClient.connectWithSigner(
      ChainInfo.rpcEndpoint,
      this.signer,
      {
        gasPrice: GasPrice.fromString(`0.01${ChainInfo.denom}`),
      },
    );
    const res = await this.provider.getKey(ChainInfo.chainId);
    this.address = res.bech32Address;
    this.onConnect?.({ address: res.bech32Address });
    this.setAutoConnect(WalletAutoConnectType.True);
    return res.bech32Address;
  }

  async disconnect() {
    this.setAutoConnect(WalletAutoConnectType.False);
    this.onDisconnect?.();
  }

  async silentConnect() {
    if (!this.provider) return;
    return await this.connect();
  }

  async signMessage(message: string) {
    if (!this.signer) throw new Error('Provider Unavailable');

    const { signed, signature } = await this.signer.signAmino(
      this.address,
      makeSignDoc(
        [],
        { amount: [], gas: '0' },
        ChainInfo.chainId,
        message,
        0,
        0,
      ),
    );
    return signature.signature;
  }

  async publishStory(
    cid: string,
    payload: Omit<WalletCallback.PublishStoryPayload, 'id'>,
  ) {
    if (!this.client) throw new Error('Provider Unavailable');
    const postId = await this.createPost(
      `${payload.name}\n${payload.description}$\n${payload.cover}\nIPFS Cid: ${cid}`,
    );
    if (!postId) throw new Error('Failed to create post');
    const { story_id } = await this.client.queryContractSmart(
      this.factoryAddress,
      {
        GetNextStoryId: {},
      },
    );
    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        PublishStory: {
          post_id: postId,
        },
      },
      'auto',
    );
    return story_id;
  }

  async updateStory(
    id: string,
    cid: string,
    clearChapterCaches?: boolean,
    payload?: Omit<WalletCallback.PublishStoryPayload, 'id'>,
  ) {
    if (!this.client) throw new Error('Provider Unavailable');
    if (!payload) throw new Error('Empty Payload');
    const { post_id } = await this.client.queryContractSmart(
      this.factoryAddress,
      {
        GetStoryInfo: {
          story_id: Number(id),
        },
      },
    );
    await this.updatePost(
      post_id,
      `${payload.name}\n${payload.description}$\n${payload.cover}\nIPFS Cid: ${cid}`,
    );
  }

  async getMintDecimals() {
    return 6;
  }

  async publishStoryNft(
    id: string,
    price: number,
    total: number,
    reserved: number,
    metadata: {
      name: string;
      desc: string;
      img: string;
    },
    uriPrefix: string,
  ) {
    if (!this.client) throw new Error('Provider Unavailable');
    const decimals = await this.getMintDecimals();
    const _price = new BigNumber(price).times(
      new BigNumber(10).pow(new BigNumber(decimals)),
    );
    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        PublishStoryNft: {
          story_id: Number(id),
          image: metadata.img,
          name: metadata.name,
          uri_prefix: uriPrefix,
          description: metadata.desc,
          price: _price.toNumber(),
          token: '',
          author_reserve: reserved,
          total: total,
        },
      },
      'auto',
    );
  }

  async mintStoryNft(
    id: string,
    author: string,
    price: string,
    nftSaleAddr: string,
    onInsufficientFinds?: (account: string, amount: string) => void,
  ) {
    if (!this.client) throw new Error('Provider Unavailable');
    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        MintStoryNft: {
          story_id: Number(id),
        },
      },
      'auto',
      undefined,
      [
        {
          denom: ChainInfo.denom,
          amount: price.toString(),
        },
      ],
    );
  }

  async balanceOfStoryNft(account: string, nftName: string, storyId: string) {
    if (!this.client) throw new Error('Provider Unavailable');
    return (await this.tokenIdOfStoryNft(account, nftName, storyId)).length;
  }

  async restOfStoryNftOnChain(nftName: string, storyId: string) {
    if (!this.client) throw new Error('Provider Unavailable');
    const { nft_info, sold } = await this.getNftSale(storyId);
    return nft_info.total - sold - nft_info.author_reserve;
  }

  async getNftAddress(storyId: string) {
    if (!this.client) throw new Error('Provider Unavailable');
    return await this.client.queryContractSmart(this.factoryAddress, {
      GetNftAddress: {
        story_id: Number(storyId),
      },
    });
  }

  async getNftSale(storyId: string) {
    if (!this.client) throw new Error('Provider Unavailable');
    return await this.client.queryContractSmart(this.factoryAddress, {
      GetNftSale: {
        story_id: Number(storyId),
      },
    });
  }

  async authorReservedNftRest(storyId: string) {
    if (!this.client) throw new Error('Provider Unavailable');
    const { nft_info, author_claimed } = await this.getNftSale(storyId);
    return nft_info.author_reserve - author_claimed;
  }

  async claimAuthorReservedNft(storyId: string, amount: number) {
    if (!this.client) throw new Error('Provider Unavailable');

    const rest = await this.authorReservedNftRest(storyId);
    if (rest < amount) return;

    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        ClaimAuthorReservedNft: {
          story_id: Number(storyId),
          mint_num: amount,
        },
      },
      'auto',
    );
  }

  async tokenIdOfStoryNft(account: string, nftName: string, storyId: string) {
    if (!this.client) throw new Error('Provider Unavailable');
    const nftAddress = await this.getNftAddress(storyId);
    const { tokens } = await this.client.queryContractSmart(nftAddress, {
      tokens: {
        owner: account,
      },
    });
    return tokens;
  }

  async createTask(
    storyId: string,
    cid: string,
    nftAddress: string,
    rewards: number[],
  ) {
    if (!this.client) throw new Error('Provider Unavailable');

    // Transfer tokens to factory
    for (const token of rewards) {
      await this.client.execute(
        this.address,
        nftAddress,
        {
          transfer_nft: {
            recipient: this.factoryAddress,
            token_id: `${token}`,
          },
        },
        'auto',
      );
    }

    // Create task
    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        CreateTask: {
          create_task_para: {
            story_id: Number(storyId),
            cid,
            nft_address: nftAddress,
            reward_nfts: rewards.join(','),
          },
        },
      },
      'auto',
    );
  }

  async updateTask(storyId: string, taskId: string, cid: string) {
    if (!this.client) throw new Error('Provider Unavailable');

    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        UpdateTask: {
          update_task_para: {
            story_id: Number(storyId),
            task_id: Number(taskId),
            cid,
          },
        },
      },
      'auto',
    );
  }

  async cancelTask(storyId: string, taskId: number) {
    if (!this.client) throw new Error('Provider Unavailable');

    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        CancelTask: {
          cancel_task_para: {
            story_id: Number(storyId),
            task_id: Number(taskId),
          },
        },
      },
      'auto',
    );
  }

  async createTaskSubmit(storyId: string, taskId: number, cid: string) {
    if (!this.client) throw new Error('Provider Unavailable');

    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        CreateTaskSubmit: {
          create_submit_para: {
            story_id: Number(storyId),
            task_id: Number(taskId),
            cid,
          },
        },
      },
      'auto',
    );
  }

  async withdrawTaskSubmit(storyId: string, taskId: number, submitId: number) {
    if (!this.client) throw new Error('Provider Unavailable');

    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        WithdrawTaskSubmit: {
          withdraw_submit_para: {
            story_id: Number(storyId),
            task_id: Number(taskId),
            submit_id: Number(submitId),
          },
        },
      },
      'auto',
    );
  }

  async markTaskDone(storyId: string, taskId: number, submitId: number) {
    if (!this.client) throw new Error('Provider Unavailable');

    await this.client.execute(
      this.address,
      this.factoryAddress,
      {
        MarkTaskDone: {
          mark_task_done_para: {
            story_id: Number(storyId),
            task_id: Number(taskId),
            submit_id: Number(submitId),
          },
        },
      },
      'auto',
    );
  }

  async createPost(content: string) {
    if (!this.client) throw new Error('Provider Unavailable');

    const msg: MsgCreatePostEncodeObject = {
      typeUrl: MsgCreatePostTypeUrl,
      value: MsgCreatePost.fromPartial({
        subspaceId: Long.fromNumber(ChainInfo.subspaceId),
        text: content,
        author: this.address,
        replySettings: ReplySetting.REPLY_SETTING_EVERYONE,
      }),
    };

    const result = await this.client.signAndBroadcast(
      this.address,
      [msg],
      'auto',
    );
    assertIsDeliverTxSuccess(result);
    return (
      result.events
        ?.find((e) => e.type === 'create_post' || e.type === 'created_post')
        ?.attributes.find((e) => e.key === 'post_id')?.value || ''
    );
  }

  async updatePost(postId: string, content: string) {
    if (!this.client) throw new Error('Provider Unavailable');

    const msg: MsgEditPostEncodeObject = {
      typeUrl: MsgEditPostTypeUrl,
      value: MsgEditPost.fromPartial({
        subspaceId: Long.fromNumber(ChainInfo.subspaceId),
        text: content,
        postId,
        editor: this.address,
      }),
    };

    const result = await this.client.signAndBroadcast(
      this.address,
      [msg],
      'auto',
    );
    assertIsDeliverTxSuccess(result);
  }
}

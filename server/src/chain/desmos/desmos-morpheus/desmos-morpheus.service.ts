import { Injectable, Logger } from '@nestjs/common';
import { DesmosClient } from "@desmoslabs/desmjs"
import { ConfigService } from '@nestjs/config';
import { StoryService } from 'src/story/story.service';
import { StoryChainTaskService } from 'src/story-chain-task/story-chain-task.service';
import { NftType } from 'src/story/entities/nft-sale.entity';
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { StdSignature, decodeSignature, makeSignDoc, serializeSignDoc } from '@cosmjs/amino';
import Long from "long";
import { StoryChainTaskStatus } from '../../../story-chain-task/entities/story-chain-task.entity';
import { StoryChainTaskSubmitStatus } from '../../../story-chain-task/entities/story-chain-task-submit.entity';

// const proxy = require("node-global-proxy").default;
// proxy.setConfig("http://127.0.0.1:7890");
// proxy.start();
// console.log("!proxy!")

@Injectable()
export class DesmosMorpheusService implements Chain.ChainIntegration {
    public chain = 'desmos';
    public name = 'desmos';
    public taskModule: Chain.TaskModuleType = 'chain';
    public factoryAddress = '';
    public findsAddress = '';
    public enabled = true;
    private _provider: DesmosClient;
    private _factory: any;
    public INTERVALS: number;
    public SUBSPACE_ID: number;
    public DENOM: string;
    public CHAINID: string;

    private _logger = new Logger(DesmosMorpheusService.name);

    constructor(
        private readonly _configSvc: ConfigService,
        private readonly _storySvc: StoryService,
        private readonly _storyTaskSvc: StoryChainTaskService,
    ) {}

    async onModuleInit() {
        this.enabled = this._configSvc.get('DESMOS_ENABLE') === 'true';
        if (!this.enabled) return;
        const enableSync = this._configSvc.get('DESMOS_ENABLE_SYNC') === 'true';
        this.factoryAddress = this._configSvc.get('DESMOS_FACTORY_ADDRESS');
        const endpoint = this._configSvc.get('DESMOS_ENDPOINT');
        this._provider = await DesmosClient.connect(endpoint);
        if (endpoint == "https://rpc.morpheus.desmos.network:443") {
            this.SUBSPACE_ID = 24 // testnet
            this.DENOM = "udaric"
            this.CHAINID = "morpheus-apollo-3"
        } else {
            this.SUBSPACE_ID = 23 // mainnet
            this.DENOM = "udsm"
            this.CHAINID = "desmos-mainnet"
        }

        if (enableSync) {
            this.INTERVALS = this._configSvc.get('DESMOS_LOOP_INTERVAL');
            this.syncChainData().catch((err) => {
              this._logger.error(`desmosSync chain data failed`, err);
            });
            this.syncChainTaskData().catch((err) => {
                this._logger.error(`desmosSync chain task data failed`, err);
              });
        }
    }

    async isPkAccountMatched(pubkey: string, account: string): Promise<boolean> {
        const account_info = await this._provider.getAccount(account);
        if (account_info.pubkey.value == pubkey) {
            return true;
        }
        return false;
    }

    async isValidSignature(
        params: Chain.IsValidSignatureParams,
      ): Promise<boolean> {
        const account_info = await this._provider.getAccount(params.account);
        const publicKey = account_info.pubkey;
        const get_signature: StdSignature = {
            pub_key: publicKey,
            signature: params.signature
        };
        const decodedSig = decodeSignature(get_signature);
        const valid1 = await Secp256k1.verifySignature(
            Secp256k1Signature.fromFixedLength(decodedSig.signature),
            sha256(serializeSignDoc(makeSignDoc([], { amount: [], gas: "0" }, this.CHAINID, params.message, 0, 0))),
            decodedSig.pubkey,
        );
        const valid2 = await Secp256k1.verifySignature(
            Secp256k1Signature.fromFixedLength(decodedSig.signature),
            sha256(serializeSignDoc(makeSignDoc([], { amount: [{"amount":"0","denom":this.DENOM}], gas: "0" }, this.CHAINID, params.message, 0, 0))),
            decodedSig.pubkey,
        );
        if (valid1 || valid2) {
            return true;
        } 
        return false;
      }

    public async formatGeneralMetadatas(
        metadatas: Chain.GeneralMetadata[],
      ): Promise<Chain.MetadataJsonFile[]> {
        return metadatas.map((m) => ({
          item: m,
          json: {
            name: m.name,
            description: m.description,
            image: m.image,
          },
        }));
    }

    public async getStory(chainStoryId: string): Promise<Chain.Story> {
        const utf8Encode = new TextEncoder();
        const contract_info = await this._provider.queryContractRaw(this.factoryAddress, utf8Encode.encode("story_factory"));
        this._factory = JSON.parse(new TextDecoder().decode(contract_info));
        const story = this._factory.stories[chainStoryId];
        if (story.story_id.toString() == '0') return null;

        const postId: number = parseInt(story.post_id, 10);
        const postInfo = await this._provider.querier.postsV3.post(Long.fromNumber(this.SUBSPACE_ID), Long.fromNumber(postId));
        const match = postInfo.text.match(/IPFS Cid: (.+)$/);
        let ipfsCid = "";
        if (match) {
            ipfsCid = match[1];
        } else {
            this._logger.debug("No CID found")
            return null;
        }
        
        return {
          id: chainStoryId,
          author: story.author,
          cid: ipfsCid,
          addr: this.factoryAddress,
        };
    }

    public async getStoryNftSale(chainStoryId: string): Promise<Chain.NftSale> {
        const utf8Encode = new TextEncoder();
        const contract_info = await this._provider.queryContractRaw(this.factoryAddress, utf8Encode.encode("story_factory"));
        this._factory = JSON.parse(new TextDecoder().decode(contract_info));
        // if ((Object.keys(this._factory.story_nft).length) == 0) return null;
        const story_nft = this._factory.story_nft[chainStoryId];
        if (story_nft == undefined) return null;
        return {
          authorClaimed: story_nft.author_claimed,
          authorReserved: story_nft.nft_info.author_reserve,
          total: story_nft.nft_info.total,
          sold: story_nft.sold,
          saleAddr: this.factoryAddress,
          name: story_nft.nft_info.name,
          uriPrefix: story_nft.nft_info.uri_prefix,
          type: '721',
          price: story_nft.nft_info.price.toString(),
        };
    }

    public async getTask(chainStoryId: string, chainTaskId: string): Promise<Chain.Task> {
        const utf8Encode = new TextEncoder();
        const contract_info = await this._provider.queryContractRaw(this.factoryAddress, utf8Encode.encode("story_factory"));
        this._factory = JSON.parse(new TextDecoder().decode(contract_info));
        const task_key = chainStoryId + "," + chainTaskId;
        const taskInfo = this._factory.story_tasks[task_key];
        if (taskInfo == undefined) return null;
        let rewardNfts = []
        if (taskInfo.reward_nfts != null) {
            const Nfts = taskInfo.reward_nfts.split(",").filter(v=>v!=="");
            for (let i=0; i<Nfts.length; i++) {
                rewardNfts.push(parseInt(Nfts[i]))
            }
        }
        return {
            id: chainTaskId,
            cid: taskInfo.cid,
            creator: taskInfo.creator,
            nft: taskInfo.nft_address,
            rewardNfts: rewardNfts.map((v) => v.toString()),
            status: taskInfo.status,
        };
    }

    public async getSubmit(chainStoryId: string, chainTaskId: string, chainSubmitId: string): Promise<Chain.Submit> {
        const utf8Encode = new TextEncoder();
        const contract_info = await this._provider.queryContractRaw(this.factoryAddress, utf8Encode.encode("story_factory"));
        this._factory = JSON.parse(new TextDecoder().decode(contract_info));
        const submit_key = chainStoryId + "," + chainTaskId + "," + chainSubmitId;
        const submitInfo = this._factory.task_submits[submit_key];
        if (submitInfo == undefined) return null;
        return {
            id: chainSubmitId,
            cid: submitInfo.cid,
            creator: submitInfo.creator,
            status: submitInfo.status
        };
    }

    private async changeTaskStatus(taskStatus: string): Promise<StoryChainTaskStatus> {
        if (taskStatus == "TODO") {
            return StoryChainTaskStatus.Todo;
        }
        if (taskStatus == "CANCELLED") {
            return StoryChainTaskStatus.Cancelled;
        }
        if (taskStatus == "DONE") {
            return StoryChainTaskStatus.Done;
        }
    }

    private async changeTaskSubmitStatus(taskSubmitStatus: string): Promise<StoryChainTaskSubmitStatus> {
        if (taskSubmitStatus == "PEDING") {
            return StoryChainTaskSubmitStatus.PENDING;
        }
        if (taskSubmitStatus == "APPROVED") {
            return StoryChainTaskSubmitStatus.APPROVED;
        }
        if (taskSubmitStatus == "WITHDRAWED") {
            return StoryChainTaskSubmitStatus.WITHDRAWED;
        }
    }

    private async syncChainTaskData() {
        const INTERVALS = this.INTERVALS * 1000;
        while (true) {
            try {

                this._logger.debug(`[desmosSyncChainTask] start`);
                const storyTasksInDb = await this._storyTaskSvc.listTasks({
                chain: this.chain,
                });
                const storyTaskSubmitsInDb = await this._storyTaskSvc.listSubmits({
                chain: this.chain,
                });
                this._logger.debug(
                    `[desmosSyncChainTask] ${storyTasksInDb.length} tasks & ${storyTaskSubmitsInDb.length} submits in db`,
                );
                const utf8Encode = new TextEncoder();
                const contract_info = await this._provider.queryContractRaw(this.factoryAddress, utf8Encode.encode("story_factory"));
                this._factory = JSON.parse(new TextDecoder().decode(contract_info));
                // 遍历task map
                const tasks = this._factory.story_tasks;
                const taskKeys = Object.keys(tasks);
                if (taskKeys.length > 0) {
                    taskKeys.forEach(async taskKey => {
                        const task_story_id = taskKey.split(',')[0];
                        const task_id = taskKey.split(',')[1];
                        const storyTaskInfo = tasks[taskKey];
                        const exitedStoryTaskInDb = storyTasksInDb.find(
                            (task) => task.chainTaskId === task_id && task.chainStoryId === task_story_id,
                        );
                        if (!exitedStoryTaskInDb){
                            console.log(storyTaskInfo);

                            let rewardNfts = []
                            if (storyTaskInfo.reward_nfts != null) {
                                const Nfts = storyTaskInfo.reward_nfts.split(",").filter(v=>v!=="");
                                for (let i=0; i<Nfts.length; i++) {
                                    rewardNfts.push(parseInt(Nfts[i]))
                                }
                            }
                            const taskStatus = await this.changeTaskStatus(storyTaskInfo.status);
                            await this._storyTaskSvc.createTask({
                              chain: this.chain,
                              chainStoryId: task_story_id,
                              chainTaskId: task_id,
                              creator: storyTaskInfo.creator,
                              nft: storyTaskInfo.nft_address,
                              rewardNfts: rewardNfts.map((v) => v.toString()),
                              cid: storyTaskInfo.cid,
                              status: taskStatus,
                            });
                          } else {
                            const taskStatus = await this.changeTaskStatus(storyTaskInfo.status);
                            await this._storyTaskSvc.updateTask({
                              chain: this.chain,
                              chainStoryId: task_story_id,
                              chainTaskId: task_id,
                              cid: storyTaskInfo.cid,
                              status: taskStatus
                            });
                          }
                    });
                }
                const submits = this._factory.task_submits;
                const submitKeys = Object.keys(submits);
                if (submitKeys.length > 0) {
                    submitKeys.forEach(async submitKey => {
                        const task_story_id = submitKey.split(',')[0];
                        const task_id = submitKey.split(',')[1];
                        const submit_id = submitKey.split(',')[2];
                        const storyTaskSubmitInfo = submits[submitKey];
                        const exitedStoryTaskSubmitInDb = storyTaskSubmitsInDb.find(
                            (submit) => submit.chainStoryId === task_story_id && submit.chainTaskId === task_id && submit.chainSubmitId === submit_id,
                        );
                        if (!exitedStoryTaskSubmitInDb) {
                            const taskSubmitStatus = await this.changeTaskSubmitStatus(storyTaskSubmitInfo.status);
                            await this._storyTaskSvc.createSubmit({
                              chain: this.chain,
                              chainStoryId: task_story_id,
                              chainTaskId: task_id,
                              chainSubmitId: submit_id,
                              creator: storyTaskSubmitInfo.creator,
                              cid: storyTaskSubmitInfo.cid,
                              status: taskSubmitStatus,
                            });
                          } else {
                            const taskSubmitStatus = await this.changeTaskSubmitStatus(storyTaskSubmitInfo.status);
                            await this._storyTaskSvc.updateSubmit({
                              chain: this.chain,
                              chainStoryId: task_story_id,
                              chainTaskId: task_id,
                              chainSubmitId: submit_id,
                              status: taskSubmitStatus,
                            });
                          }
                    });
                }
            } catch (e) {
                this._logger.error(`desmosSync Desmos chain task data failed`, e);
            } finally {
                await new Promise((res) => setTimeout(res, INTERVALS));
            }
        }
    }

    private async syncChainData() {
        const INTERVALS = this.INTERVALS * 1000;
        while (true) {
            try {
                const toCreateStories: Parameters<StoryService['createStories']>[0] = [];
                const toUpdateStories: Parameters<StoryService['updateStoriesContentHash']>[0] = [];
                const toCreateSales: Parameters<StoryService['createNftSales']>[0] = [];
                const toUpdateSales: Parameters<StoryService['updateNftSales']>[0] = [];
                this._logger.debug(`[desmosSync] start`);
                const storiesInDb = await this._storySvc.listStories({
                    chain: [this.chain],
                });
                const salesInDb = await this._storySvc.listNftSales({
                    chain: [this.chain],
                });
                this._logger.debug(
                    `[desmosSync] ${storiesInDb.length} stories & ${salesInDb.length} sales in db`,
                );
                const utf8Encode = new TextEncoder();
                const contract_info = await this._provider.queryContractRaw(this.factoryAddress, utf8Encode.encode("story_factory"));
                this._factory = JSON.parse(new TextDecoder().decode(contract_info));
                const nextStoryId = this._factory.next_story_id;
                // console.log(this._factory);
                if (nextStoryId == 1) {
                    this._logger.debug(
                        `[desmosSync] There is no story on chain.`,
                    );
                    continue;
                }
                this._logger.debug(
                    `[desmosSync] ${nextStoryId - 1} stories on chain`
                );
                for (let storyId = 1; storyId < nextStoryId; storyId++) {
                    const existedStoryInDb = storiesInDb.find(
                        (story) => story.chainStoryId === storyId.toString(),
                    );
                    const storyInfo = await this.getStory(storyId.toString());
                    if (!existedStoryInDb) {
                        toCreateStories.push({
                            chain: this.chain,
                            chainStoryId: storyInfo.id,
                            onChainAddr: storyInfo.addr,
                            author: storyInfo.author,
                            contentHash: storyInfo.cid,
                        });
                    } else {
                        if (existedStoryInDb.contentHash !== storyInfo.cid) {
                            toUpdateStories.push({
                                chain: this.chain,
                                chainStoryId: storyInfo.id,
                                contentHash: storyInfo.cid,
                            });
                        }
                    }
                    const sale = await this.getStoryNftSale(storyId.toString());
                    if (sale) {
                        const existedSaleInDb = salesInDb.find((sale) => sale.chainStoryId === storyId.toString(),);
                        if (!existedSaleInDb) {
                            toCreateSales.push({
                                chain: this.chain,
                                chainStoryId: storyId.toString(),
                                nftSaleAddr: this.factoryAddress,
                                name: unescape(sale.name),
                                uriPrefix: sale.uriPrefix,
                                type: NftType.NON_FUNGIBLE_TOKEN,
                                price: sale.price,
                                total: sale.total,
                                sold: sale.sold,
                                authorClaimed: sale.authorClaimed,
                                authorReserved: sale.authorReserved,
                            });
                        } else {
                            if (
                                existedSaleInDb.sold !== sale.sold ||
                                existedSaleInDb.authorClaimed !== sale.authorClaimed
                            ) {
                                toUpdateSales.push({
                                ...existedSaleInDb,
                                sold: sale.sold,
                                authorClaimed: sale.authorClaimed,
                                });
                            }
                        }
                    }
                }
                this._logger.debug(
                    `[desmosSync] stories : ${toCreateStories.length} created ${toUpdateStories.length} updated`,
                );
                this._logger.debug(
                    `[desmosSync] sales : ${toCreateSales.length} created ${toUpdateSales.length} updated`,
                );
                await this._storySvc.createStories(toCreateStories);
                await this._storySvc.updateStoriesContentHash(toUpdateStories);
                await this._storySvc.createNftSales(toCreateSales);
                await this._storySvc.updateNftSales(toUpdateSales);
                this._logger.debug(`[desmosSync] done`);
            }
            catch (e) {
                this._logger.error(`desmosSync Desmos chain data failed`, e);
            }
            finally {
                await new Promise((res) => setTimeout(res, INTERVALS));
            }
        }
    }
}
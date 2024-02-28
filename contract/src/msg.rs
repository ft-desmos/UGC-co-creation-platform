use std::collections::HashMap;

use cosmwasm_std::Addr;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub enum ExecuteMsg {
    PublishStory { post_id: String},
    // UpdateStory { story_id: u64, post_id: String},
    PublishStoryNft { 
        story_id: u64,
        image: String,
        name: String,
        uri_prefix: String,
        description: String,
        price: i32,
        token: String,
        author_reserve: i32,
        total: i32,
    },
    MintStoryNft { story_id: u64 },
    ClaimAuthorReservedNft { story_id: u64, mint_num: i32 },
    CreateTask { create_task_para: CreateTaskPara },
    UpdateTask { update_task_para: UpdateTaskPara },
    CancelTask { cancel_task_para: CancelTaskPara },
    CreateTaskSubmit { create_submit_para: UpdateTaskPara },
    WithdrawTaskSubmit { withdraw_submit_para: WithdrawTaskSubmitPara },
    MarkTaskDone { mark_task_done_para: WithdrawTaskSubmitPara },
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct GetStoryIdResp {
    pub story_id: u64,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub enum QueryMsg {
    GetNextStoryId {},
    GetStoryInfo { story_id: u64 },
    GetNftAddress { story_id: u64 },
    GetNftSale { story_id: u64},
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct Story {
    pub story_id: u64,
    pub author: Addr,
    pub post_id: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct StoryFactory {
    pub next_story_id: u64,
    pub stories: HashMap<u64, Story>,
    pub story_nft: HashMap<u64, StoryNft>,
    pub nft_contracts: HashMap<u64, String>,
    pub story_task_id: HashMap<u64, u64>, // StoryID, NextTaskID
    pub story_tasks: HashMap<String, Task>, // StoryID,TaskID, TaskInfo
    pub task_submits: HashMap<String, Submit>, // StoryID,TaskID,SubmitID, SubmitInfo
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct PublishNftMsg {
    pub story_id: u64,
    pub name: String,
    pub image: String,
    pub description: String,
    pub uri_prefix: String,
    pub token: String,
    pub price: i32,
    pub total: i32,
    pub author_reserve: i32,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct StoryNft {
    pub nft_info: PublishNftMsg,
    pub author: Addr,
    pub sold: i32,
    pub author_claimed: i32,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct CreateTaskPara {
    pub story_id: u64,
    pub cid: String,
    pub nft_address: String,
    pub reward_nfts: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct UpdateTaskPara {
    pub story_id: u64,
    pub task_id: u64,
    pub cid: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct CancelTaskPara {
    pub story_id: u64,
    pub task_id: u64,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct WithdrawTaskSubmitPara {
    pub story_id: u64,
    pub task_id: u64,
    pub submit_id: u64
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct Task {
    pub id: u64,
    pub cid: String,
    pub creator: Addr,
    pub nft_address: String,
    pub reward_nfts: String,
    pub status: String,
    pub next_submit_id: u64,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct Submit {
    pub id: u64,
    pub cid: String,
    pub creator: Addr,
    pub status: String,
}
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
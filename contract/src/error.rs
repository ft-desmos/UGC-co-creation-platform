use cosmwasm_std::{Addr, StdError, Uint128};
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    StdError(#[from] StdError),
    #[error("{sender} is not story author")]
    Unauthorized { sender: Addr },
    #[error("story ID: {story_id}, not found")]
    StoryNotFound { story_id: u64 },
    #[error("story ID: {story_id}, nft not found")]
    StoryNftNotFound { story_id: u64 },
    #[error("story ID: {story_id}, nft sold out")]
    StoryNftSoldOut { story_id: u64 },
    #[error("msg story ID: {msg_story_id}, nft not found")]
    MsgStoryNftNotFound { msg_story_id: u64 },
    #[error("Underpayment of fees!")]
    PayNotEnough { },
    #[error("Nft mint error!")]
    NftMintError { },
    #[error("uosmo get: {amount}")]
    Test1 { amount: Uint128 },
    #[error("get: {denom}, {amount}")]
    Test2 { denom: String, amount: Uint128 },
}

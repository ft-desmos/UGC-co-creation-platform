use std::collections::HashMap;
use crate::error::ContractError;
use crate::msg::{ExecuteMsg, QueryMsg, StoryFactory, GetStoryIdResp, Story, StoryNft, PublishNftMsg};
use crate::state::STORYFACTORY;
use cosmwasm_std::{to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult, Empty, ReplyOn, Reply, Addr, StdError, SubMsg, WasmMsg, BankMsg, Coin};
use cw721_base::msg::InstantiateMsg as Cw721InstantiateMsg;
use cw721_base::msg::ExecuteMsg as Cw721ExecuteMsg;
// use cw721_base::
use cw_utils::parse_reply_instantiate_data;
#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    _msg: Empty,
) -> StdResult<Response> {
    let story_factory = StoryFactory {
        next_story_id: 1,
        stories: HashMap::new(),
        story_nft: HashMap::new(),
        nft_contracts: HashMap::new(),
    };
    STORYFACTORY.save(deps.storage, &story_factory)?;
    Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    use QueryMsg::*;
    match msg {
        GetNextStoryId {} => to_json_binary(&get_next_story_id(deps)?),
        GetStoryInfo { story_id } => to_json_binary(&get_story_info(deps, story_id)?),
        GetNftAddress { story_id } => to_json_binary(&get_nft_address(deps, story_id)?),
        GetNftSale {story_id } => to_json_binary(&get_nft_sale(deps, story_id)?),
    }
}

pub fn get_next_story_id(deps: Deps) -> StdResult<GetStoryIdResp> {
    let story_factory = STORYFACTORY.load(deps.storage)?;
    let next_story_id = GetStoryIdResp { story_id: story_factory.next_story_id.clone() };
    Ok(next_story_id)
}

pub fn get_story_info(deps: Deps, story_id: u64) -> StdResult<Story> {
    let story_factory = STORYFACTORY.load(deps.storage)?;
    match story_factory.stories.get(&story_id) {
        Some(story_info) => {
            Ok(story_info.clone())
        },
        None => {
            return Err(StdError::generic_err("story ID not found"));
        },
    }
}

pub fn get_nft_address(deps: Deps, story_id: u64) -> StdResult<String> {
    let story_factory = STORYFACTORY.load(deps.storage)?;
    match story_factory.nft_contracts.get(&story_id) {
        Some(nft_addr) => {
            Ok(nft_addr.clone())
        },
        None => {
            return Err(StdError::generic_err("story NFT not found"));
        },
    }
}

pub fn get_nft_sale(deps: Deps, story_id: u64) -> StdResult<StoryNft> {
    let story_factory = STORYFACTORY.load(deps.storage)?;
    match story_factory.story_nft.get(&story_id) {
        Some(nft_sale) => {
            Ok(nft_sale.clone())
        },
        None => {
            return Err(StdError::generic_err("story NFT not found"));
        },
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    use ExecuteMsg::*;
    match msg {
        PublishStory { post_id } => publish_story(deps, info, post_id),
        // UpdateStory { story_id, post_id } => update_story(deps, info, story_id, post_id),
        PublishStoryNft { 
            story_id, 
            image, 
            name, 
            uri_prefix, 
            description, 
            price, 
            token, 
            author_reserve, 
            total 
        } => publish_nft(deps, _env, info, story_id, image, name, uri_prefix, description, price, token, author_reserve, total),
        MintStoryNft { story_id } => mint_story_nft(deps, _env, info, story_id),
    }
}

pub fn publish_story(deps: DepsMut, info: MessageInfo, post_id: String) -> Result<Response, ContractError> {
    STORYFACTORY.update(deps.storage, |mut story_factory| -> Result<_, ContractError> {
        let new_story = Story {
            story_id: story_factory.next_story_id.clone(),
            author: info.sender.clone(),
            post_id,
        };
        story_factory.stories.insert(story_factory.next_story_id, new_story);
        story_factory.next_story_id += 1;
        Ok(story_factory)
    })?;
    Ok(Response::new())
}

// pub fn update_story(deps: DepsMut, info: MessageInfo, story_id: u64, post_id: String) -> Result<Response, ContractError> {
//     STORYFACTORY.update(deps.storage, |mut story_factory| -> Result<_, ContractError> {
//         match story_factory.stories.get(&story_id) {
//             Some(story_info) => {
//                 if info.sender != story_info.author {
//                     return Err(ContractError::Unauthorized { sender: info.sender });
//                 }
//                 let new_story = Story {
//                     story_id: story_info.story_id.clone(),
//                     author: info.sender.clone(),
//                     post_id,
//                 };
//                 story_factory.stories.insert(story_info.story_id, new_story);
//                 Ok(story_factory)
//             },
//             None => {
//                 return Err(ContractError::StoryNotFound { story_id });
//             },
//         }
//     })?;
//     Ok(Response::new())
// }

pub fn publish_nft(
    deps: DepsMut, 
    env: Env,
    info: MessageInfo, 
    story_id: u64,
    image: String,
    name: String,
    uri_prefix: String,
    description: String,
    price: i32,
    token: String,
    author_reserve: i32,
    total: i32,
) -> Result<Response, ContractError> {
    let sub_msg: Vec<SubMsg> = vec![SubMsg {
        msg: WasmMsg::Instantiate {
            code_id: 10,
            msg: to_json_binary(&Cw721InstantiateMsg {
                name: story_id.clone().to_string(),
                symbol: story_id.clone().to_string(),
                minter: env.contract.address.to_string(),
            })?,
            funds: vec![],
            admin: None,
            label: String::from("Story NFT"),
        }
        .into(),
        id: story_id.clone(),
        gas_limit: None,
        reply_on: ReplyOn::Success,
    }];
    let mut story_factory = STORYFACTORY.load(deps.storage)?;
    match story_factory.stories.get(&story_id) {
        Some(story_info) => {
            if info.sender != story_info.author {
                return Err(ContractError::Unauthorized { sender: info.sender });
            }
            let new_nft_info = PublishNftMsg { story_id, name, image, description, uri_prefix, token, price, total, author_reserve };
            let new_story_nft = StoryNft {
                sold: 0,
                author: story_info.author.clone(),
                author_claimed: 0,
                nft_info: new_nft_info,
            };
            story_factory.story_nft.insert(story_id, new_story_nft);
            STORYFACTORY.save(deps.storage, &story_factory)?;
            Ok(Response::new().add_submessages(sub_msg))
        },
        None => {
            return Err(ContractError::StoryNotFound { story_id });
        },
    }
}

pub fn mint_story_nft(deps: DepsMut, _env: Env, info: MessageInfo, story_id: u64) -> Result<Response, ContractError> {
    let mut story_factory = STORYFACTORY.load(deps.storage)?;
    let mint_token_id: String;
    let mint_token_uri: String;
    let transfer_sub_msg: Vec<SubMsg>;
    match story_factory.story_nft.get(&story_id) {
        Some(story_nft_info) => {
            if story_nft_info.nft_info.total <= (story_nft_info.sold + story_nft_info.author_claimed) {
                return Err(ContractError::StoryNftSoldOut { story_id });
            }

            let fee_amount = Coin::new(story_nft_info.nft_info.price.try_into().unwrap(), "udsm");
            if info.funds.is_empty() || info.funds.iter().all(|x| *x != fee_amount) {
                return Err(ContractError::PayNotEnough { });
            }
            let recipient = story_nft_info.author.clone();
            let transfer_msg = BankMsg::Send {
                to_address: recipient.to_string(),
                amount: vec![fee_amount.clone()],
            };
            transfer_sub_msg = vec![SubMsg::new(transfer_msg)];
            mint_token_id = ((story_nft_info.author_claimed + story_nft_info.sold) + 1).to_string();
            mint_token_uri = story_nft_info.nft_info.uri_prefix.clone() + "/" + &mint_token_id + ".json";
            let new_story_nft = StoryNft {
                sold: story_nft_info.sold.clone() + 1,
                author_claimed: story_nft_info.author_claimed.clone(),
                nft_info: story_nft_info.nft_info.clone(),
                author: story_nft_info.author.clone(),
            };
            story_factory.story_nft.insert(story_id, new_story_nft);
            STORYFACTORY.save(deps.storage, &story_factory)?;
        },
        None => {
            return Err(ContractError::StoryNftNotFound { story_id });
        },
    };
    let nft_addr: String;
    match story_factory.nft_contracts.get(&story_id) {
        Some(nft_address) => {
            nft_addr = nft_address.to_string();
        },
        None => {
            return Err(ContractError::StoryNftNotFound { story_id });
        },
    };
    let mint_msg = Cw721ExecuteMsg::<_, Empty>::Mint {
        token_id: mint_token_id, 
        owner: info.sender.to_string(), 
        extension: {}, 
        token_uri: Some(mint_token_uri), 
    };
    let sub_msg: Vec<SubMsg> = vec![SubMsg {
        msg: WasmMsg::Execute {
            contract_addr: nft_addr,
            msg: to_json_binary(&mint_msg)?,
            funds: vec![],
        }
        .into(),
        id: 0,
        gas_limit: None,
        reply_on: ReplyOn::Error,
    }];
    Ok(Response::new().add_submessages(transfer_sub_msg).add_submessages(sub_msg))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(deps: DepsMut, _env: Env, msg: Reply) -> Result<Response, ContractError> {
    let mut story_factory = STORYFACTORY.load(deps.storage)?;
    if msg.id == 0 {
        return Err(ContractError::NftMintError {  });
    } else {
        let reply = parse_reply_instantiate_data(msg.clone()).unwrap();
        let contract_addr = Addr::unchecked(reply.contract_address).into();
        story_factory.nft_contracts.insert(msg.id.clone(), contract_addr);
        STORYFACTORY.save(deps.storage, &story_factory)?;
        Ok(Response::new())
    }
}
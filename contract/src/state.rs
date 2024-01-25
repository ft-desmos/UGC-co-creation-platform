use cw_storage_plus::Item;
use crate::msg::StoryFactory;

pub const STORYFACTORY: Item<StoryFactory> = Item::new("story_factory");

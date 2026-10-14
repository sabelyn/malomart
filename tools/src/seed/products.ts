import type { CreateProductBody } from "@mm/lib/products";

export type SeedProduct = CreateProductBody & {
  slug: string;
  images: string[];
};

export const products: SeedProduct[] = [
  {
    slug: "heros-clothes",
    title: "Hero's Clothes",
    description: "Green tunic. Pointy hat. Heroism sold separately.",
    category: "Armor",
    price: 150,
    stockCount: 6,
    features: ["Breathable linen", "Hat included", "Machine washable"],
    images: ["tp-items/equipment/heros-clothes.png"]
  },
  {
    slug: "zora-armor",
    title: "Zora Armor",
    description: "Breathe underwater. Very heavy on land. Not our problem.",
    category: "Armor",
    price: 250,
    originalPrice: 300,
    stockCount: 2,
    features: ["Underwater breathing", "Cold-water rated", "Fish-scale finish"],
    images: ["tp-items/equipment/zora-armor.png"]
  },
  {
    slug: "magic-armor",
    title: "Magic Armor",
    description:
      "Damage costs rupees instead of hearts. Also costs rupees while you stand around. Malo Mart accepts rupees.",
    category: "Armor",
    price: 598,
    stockCount: 1,
    features: ["Converts damage into rupee loss", "Drains rupees while worn", "Polished brass finish"],
    images: ["tp-items/equipment/magic-armor.png"]
  },
  {
    slug: "iron-boots",
    title: "Iron Boots",
    description: "Heavy. You will not blow away. You will not float either. Choose carefully.",
    category: "Armor",
    price: 120,
    stockCount: 4,
    features: ["Magnetic soles", "Holds firm in strong currents", "Doubles as a doorstop"],
    images: ["tp-items/inventory/iron-boots.png"]
  },
  {
    slug: "arrows-30",
    title: "Arrows (Bundle of 30)",
    description: "Thirty arrows. Pointy end goes forward.",
    category: "Arrows",
    price: 30,
    stockCount: 99,
    features: ["Bundle of 30", "Fits any quiver"],
    images: ["tp-items/collectibles/arrows.png"]
  },
  {
    slug: "quiver",
    title: "Quiver",
    description: "Holds arrows. Thirty of them.",
    category: "Arrows",
    price: 50,
    stockCount: 10,
    features: ["Holds 30 arrows"],
    images: ["tp-items/upgrades/quiver.png"]
  },
  {
    slug: "big-quiver",
    title: "Big Quiver",
    description: "Holds more arrows. Sixty of them.",
    category: "Arrows",
    price: 120,
    stockCount: 5,
    features: ["Holds 60 arrows"],
    images: ["tp-items/upgrades/big-quiver.png"]
  },
  {
    slug: "giant-quiver",
    title: "Giant Quiver",
    description: "Holds a hundred arrows. Your back will hurt.",
    category: "Arrows",
    price: 250,
    originalPrice: 300,
    stockCount: 2,
    features: ["Holds 100 arrows", "Reinforced strap"],
    images: ["tp-items/upgrades/giant-quiver.png"]
  },
  {
    slug: "bombs-10",
    title: "Bombs (Pack of 10)",
    description: "They explode. Do not hold them for long.",
    category: "Bombs",
    price: 50,
    stockCount: 40,
    features: ["Pack of 10", "Short fuse", "Clears cracked walls"],
    images: ["tp-items/inventory/bombs.png"]
  },
  {
    slug: "water-bombs-5",
    title: "Water Bombs (Pack of 5)",
    description: "Explodes underwater. Also above water. Mostly underwater.",
    category: "Bombs",
    price: 60,
    stockCount: 20,
    features: ["Pack of 5", "Waterproof fuse"],
    images: ["tp-items/inventory/water-bombs.png"]
  },
  {
    slug: "bomblings-10",
    title: "Bomblings (Pack of 10)",
    description: "Small bombs with legs. They walk forward. Do not follow them.",
    category: "Bombs",
    price: 70,
    originalPrice: 90,
    stockCount: 15,
    features: ["Self-propelled", "Pack of 10", "Climbs gentle slopes"],
    images: ["tp-items/inventory/bomblings.png"]
  },
  {
    slug: "bomb-bag",
    title: "Bomb Bag",
    description: "Holds bombs. Two styles. Same bombs.",
    category: "Bombs",
    price: 100,
    stockCount: 8,
    features: ["Holds 30 bombs", "Available in round or sack"],
    images: ["tp-items/upgrades/bomb-bag-round.png", "tp-items/upgrades/bomb-bag-sack.png"]
  },
  {
    slug: "milk",
    title: "Fresh Milk (Bottled)",
    description: "From Ordon goats. Drink half now. Drink half later.",
    category: "Food",
    price: 10,
    stockCount: 24,
    features: ["Two servings per bottle", "Restores a little health"],
    images: ["tp-items/bottles/milk.png"]
  },
  {
    slug: "ordon-pumpkin",
    title: "Ordon Pumpkin",
    description: "Big. Orange. Good in soup.",
    category: "Food",
    price: 25,
    stockCount: 12,
    features: ["Locally grown", "Soup-grade"],
    images: ["tp-items/quest/ordon-pumpkin.png"]
  },
  {
    slug: "pumpkin-seeds",
    title: "Pumpkin Seeds",
    description: "Plant them. Wait. Get pumpkins. Or eat them now.",
    category: "Food",
    price: 5,
    stockCount: 50,
    features: [],
    images: ["tp-items/collectibles/pumpkin-seeds.png"]
  },
  {
    slug: "bee-larva",
    title: "Bee Larva (Bottled)",
    description: "Technically food. Fish agree.",
    category: "Food",
    price: 10,
    stockCount: 18,
    features: ["Restores a little health", "Doubles as bait"],
    images: ["tp-items/bottles/bee-larva.png"]
  },
  {
    slug: "clawshot",
    title: "Clawshot",
    description: "Shoots a claw. Pulls you to whatever it grabs. Grab something good.",
    category: "Gadgets",
    price: 300,
    stockCount: 3,
    features: ["Spring-loaded chain", "Latches onto mesh and vines"],
    images: ["tp-items/inventory/clawshot.png"]
  },
  {
    slug: "double-clawshots",
    title: "Double Clawshots",
    description: "Two claws. Swing between things. Do not look down.",
    category: "Gadgets",
    price: 550,
    originalPrice: 600,
    stockCount: 1,
    features: ["One for each hand", "Chain-to-chain transfers"],
    images: ["tp-items/inventory/double-clawshots.png"]
  },
  {
    slug: "spinner",
    title: "Spinner",
    description: "Stand on it. Spin. Ride the grooves in the wall. Get dizzy.",
    category: "Gadgets",
    price: 200,
    stockCount: 2,
    features: ["Rides wall tracks", "Crosses quicksand"],
    images: ["tp-items/inventory/spinner.png"]
  },
  {
    slug: "gale-boomerang",
    title: "Gale Boomerang",
    description: "Throw it. Wind does the rest. It comes back. Usually.",
    category: "Gadgets",
    price: 150,
    stockCount: 4,
    features: ["Lock onto up to five targets", "Spins windmills", "Fairy not included"],
    images: ["tp-items/inventory/gale-boomerang.png"]
  },
  {
    slug: "dominion-rod",
    title: "Dominion Rod",
    description: "Moves statues. Statues not included.",
    category: "Gadgets",
    price: 400,
    stockCount: 0,
    features: ["Animates ancient statues"],
    images: ["tp-items/inventory/dominion-rod.png"]
  },
  {
    slug: "lantern",
    title: "Lantern",
    description: "Lights torches. Lights dark rooms. Needs oil. Sold here.",
    category: "Gadgets",
    price: 80,
    stockCount: 9,
    features: ["Refillable", "Burns away cobwebs"],
    images: ["tp-items/inventory/lantern.png"]
  },
  {
    slug: "hawkeye",
    title: "Hawkeye",
    description: "See far things up close. Wear it with a bow for long shots.",
    category: "Gadgets",
    price: 100,
    stockCount: 5,
    features: ["Telescopic lens", "Pairs with any bow"],
    images: ["tp-items/inventory/hawkeye.png"]
  },
  {
    slug: "horse-call",
    title: "Horse Call",
    description: "Blow into it. Your horse comes. Horse not included.",
    category: "Gadgets",
    price: 40,
    stockCount: 7,
    features: [],
    images: ["tp-items/inventory/horse-call.png"]
  },
  {
    slug: "ooccoo",
    title: "Ooccoo & Son",
    description: "Gets you out of dungeons fast. Talks the whole time. Son included.",
    category: "Gadgets",
    price: 350,
    stockCount: 1,
    features: ["Instant dungeon exit", "Return trip via son", "Chatty"],
    images: ["tp-items/inventory/ooccoo.png", "tp-items/inventory/ooccoo-jr.png"]
  },
  {
    slug: "fishing-rod",
    title: "Fishing Rod",
    description: "For fish. Works with worms, bee larva, or a coral earring. Bait sold separately.",
    category: "Gadgets",
    price: 40,
    stockCount: 14,
    features: ["Hand-carved", "Accepts most bait", "Lure-compatible"],
    images: [
      "tp-items/fishing/rod.png",
      "tp-items/fishing/rod-worm.png",
      "tp-items/fishing/rod-bee-larva.png",
      "tp-items/fishing/rod-coral-earring.png",
      "tp-items/fishing/rod-coral-earring-worm.png",
      "tp-items/fishing/rod-coral-earring-bee-larva.png"
    ]
  },
  {
    slug: "red-potion",
    title: "Red Potion",
    description: "Restores eight hearts. Tastes red.",
    category: "Potions",
    price: 30,
    stockCount: 30,
    features: ["Restores 8 hearts"],
    images: ["tp-items/bottles/red-potion.png"]
  },
  {
    slug: "blue-potion",
    title: "Blue Potion",
    description: "Restores all hearts. Costs more. That is how it works.",
    category: "Potions",
    price: 100,
    stockCount: 8,
    features: ["Restores all hearts"],
    images: ["tp-items/bottles/light-blue.png"]
  },
  {
    slug: "purple-chu-jelly",
    title: "Purple Chu Jelly",
    description: "Random effect. Could heal. Could hurt. No refunds.",
    category: "Potions",
    price: 15,
    originalPrice: 20,
    stockCount: 11,
    features: ["Effect varies", "No refunds"],
    images: ["tp-items/bottles/purple.png"]
  },
  {
    slug: "black-chu-jelly",
    title: "Black Chu Jelly",
    description: "Not recommended. We sell it anyway.",
    category: "Potions",
    price: 5,
    stockCount: 40,
    features: ["Restores nothing", "Strong aftertaste"],
    images: ["tp-items/bottles/black.png"]
  },
  {
    slug: "rare-chu-jelly",
    title: "Rare Chu Jelly",
    description: "Rare. Heals a lot. Do not ask where we got it.",
    category: "Potions",
    price: 150,
    stockCount: 1,
    features: ["Restores all hearts", "Limited supply"],
    images: ["tp-items/bottles/orange-spotted.png"]
  },
  {
    slug: "lantern-oil",
    title: "Lantern Oil",
    description: "Fills your lantern. Do not drink it.",
    category: "Potions",
    price: 20,
    stockCount: 25,
    features: ["Full refill", "Not for drinking"],
    images: ["tp-items/bottles/lantern-oil.png"]
  },
  {
    slug: "bottled-fairy",
    title: "Fairy in a Bottle",
    description: "Revives you once when you fall. She does not like the bottle.",
    category: "Potions",
    price: 200,
    originalPrice: 250,
    stockCount: 3,
    features: ["Automatic revive", "Restores 8 hearts"],
    images: ["tp-items/bottles/fairy.png"]
  },
  {
    slug: "hylian-shield",
    title: "Hylian Shield",
    description: "Metal. Does not burn. Malo Mart exclusive.",
    category: "Shields",
    price: 200,
    stockCount: 5,
    features: ["Fireproof", "Royal crest", "Blocks most projectiles"],
    images: ["tp-items/equipment/hylian-shield.png"]
  },
  {
    slug: "ordon-shield",
    title: "Ordon Shield",
    description: "Wood with a metal rim. Burns. Keep away from fire.",
    category: "Shields",
    price: 50,
    originalPrice: 80,
    stockCount: 6,
    features: ["Locally made", "Flammable"],
    images: ["tp-items/equipment/ordon-shield.png"]
  },
  {
    slug: "wooden-shield",
    title: "Wooden Shield",
    description: "Wood. Burns. Cheap.",
    category: "Shields",
    price: 30,
    stockCount: 20,
    features: ["Flammable"],
    images: ["tp-items/equipment/wooden-shield.png"]
  },
  {
    slug: "master-sword",
    title: "Master Sword",
    description: "Blade of evil's bane. Currently in a pedestal. Ask about the waiting list.",
    category: "Weapons",
    price: 9999,
    stockCount: 0,
    features: ["Repels evil", "Pedestal sold separately"],
    images: ["tp-items/equipment/master-sword.png"]
  },
  {
    slug: "ordon-sword",
    title: "Ordon Sword",
    description: "Made by the Ordon blacksmith. Sharp.",
    category: "Weapons",
    price: 100,
    stockCount: 4,
    features: ["Forged in Ordon", "Comes with sheath"],
    images: ["tp-items/equipment/ordon-sword.png"]
  },
  {
    slug: "wooden-sword",
    title: "Wooden Sword",
    description: "Practice sword. Hits like a stick. Is a stick.",
    category: "Weapons",
    price: 20,
    stockCount: 15,
    features: [],
    images: ["tp-items/equipment/wooden-sword.png"]
  },
  {
    slug: "heros-bow",
    title: "Hero's Bow",
    description: "Shoots arrows. Arrows sold separately. See Arrows.",
    category: "Weapons",
    price: 150,
    stockCount: 6,
    features: ["Pairs with Hawkeye", "Bomb-arrow compatible"],
    images: ["tp-items/inventory/heros-bow.png"]
  },
  {
    slug: "slingshot",
    title: "Slingshot",
    description: "For kids. Works on cuccos. Do not shoot cuccos.",
    category: "Weapons",
    price: 30,
    originalPrice: 40,
    stockCount: 10,
    features: ["Uses seeds as ammo"],
    images: ["tp-items/inventory/slingshot.png"]
  },
  {
    slug: "ball-and-chain",
    title: "Ball and Chain",
    description: "Very heavy. Very effective. Swing it and hope.",
    category: "Weapons",
    price: 450,
    stockCount: 1,
    features: ["Breaks ice and armor", "Two-handed"],
    images: ["tp-items/inventory/ball-and-chain.png"]
  },
  {
    slug: "wallet",
    title: "Wallet",
    description: "Holds 300 rupees. Spend them here.",
    category: "Misc",
    price: 30,
    stockCount: 20,
    features: ["Holds 300 rupees"],
    images: ["tp-items/upgrades/wallet.png"]
  },
  {
    slug: "big-wallet",
    title: "Big Wallet",
    description: "Holds 600 rupees. Spend them here too.",
    category: "Misc",
    price: 120,
    stockCount: 6,
    features: ["Holds 600 rupees"],
    images: ["tp-items/upgrades/big-wallet.png"]
  },
  {
    slug: "giant-wallet",
    title: "Giant Wallet",
    description: "Holds 1,000 rupees. Now you can afford the Magic Armor.",
    category: "Misc",
    price: 300,
    stockCount: 2,
    features: ["Holds 1,000 rupees"],
    images: ["tp-items/upgrades/giant-wallet.png"]
  },
  {
    slug: "empty-bottle",
    title: "Empty Bottle",
    description: "A bottle. Empty. Very useful. Very rare.",
    category: "Misc",
    price: 50,
    stockCount: 0,
    features: ["Holds potions, fairies, bait, soup"],
    images: ["tp-items/bottles/empty.png"]
  },
  {
    slug: "worm",
    title: "Worm (Bottled)",
    description: "Bait. Not food. Please.",
    category: "Misc",
    price: 5,
    stockCount: 60,
    features: ["Fish love it"],
    images: ["tp-items/bottles/worm.png"]
  },
  {
    slug: "coral-earring",
    title: "Coral Earring",
    description: "Fancy lure. Also an earring. Fish like it more than people do.",
    category: "Misc",
    price: 80,
    stockCount: 3,
    features: ["Catches rare fish", "Wearable, technically"],
    images: ["tp-items/fishing/coral-earring.png"]
  },
  {
    slug: "heart-container",
    title: "Heart Container",
    description: "Adds one heart. Permanently.",
    category: "Misc",
    price: 500,
    stockCount: 3,
    features: ["+1 maximum heart", "Full heal on use"],
    images: ["tp-items/collectibles/heart-container.png"]
  },
  {
    slug: "piece-of-heart",
    title: "Piece of Heart",
    description: "Collect five. Get one heart. Math.",
    category: "Misc",
    price: 120,
    stockCount: 10,
    features: ["Five pieces make a Heart Container"],
    images: [
      "tp-items/collectibles/heart-piece-1.png",
      "tp-items/collectibles/heart-piece-2.png",
      "tp-items/collectibles/heart-piece-3.png",
      "tp-items/collectibles/heart-piece-4.png",
      "tp-items/collectibles/heart-full.png"
    ]
  },
  {
    slug: "poe-soul",
    title: "Poe Soul",
    description: "Ghost fragment. A family in Kakariko wants sixty. We have some.",
    category: "Misc",
    price: 20,
    stockCount: 13,
    features: ["Ethically haunted"],
    images: ["tp-items/collectibles/poe-soul.png"]
  },
  {
    slug: "small-key",
    title: "Small Key",
    description: "Opens one door. Just one.",
    category: "Misc",
    price: 10,
    stockCount: 35,
    features: ["Single use", "Dungeon-specific"],
    images: ["tp-items/dungeon/key-blue.png"]
  },
  {
    slug: "key-shards",
    title: "Boss Key Shards",
    description: "Three pieces of a boss key. Assembly required.",
    category: "Misc",
    price: 180,
    stockCount: 2,
    features: ["Three-piece set", "Assembly required"],
    images: [
      "tp-items/dungeon/key-shards-combined-b.png",
      "tp-items/dungeon/key-shard-1.png",
      "tp-items/dungeon/key-shard-2.png",
      "tp-items/dungeon/key-shard-3.png",
      "tp-items/dungeon/key-shards-combined-a.png"
    ]
  },
  {
    slug: "map-and-compass",
    title: "Dungeon Map & Compass",
    description: "Know where you are. Know where the treasure is. Still have to walk there.",
    category: "Misc",
    price: 60,
    stockCount: 9,
    features: ["Shows every room", "Points to treasure"],
    images: ["tp-items/dungeon/dungeon-map.png", "tp-items/dungeon/compass.png"]
  },
  {
    slug: "hidden-skill-scroll",
    title: "Hidden Skill Scroll",
    description: "Teaches a sword technique. Ghost wolf not included.",
    category: "Misc",
    price: 250,
    stockCount: 4,
    features: ["One technique per scroll"],
    images: ["tp-items/upgrades/scroll.png"]
  }
];

import type { GoogleSignInError } from "@mm/lib/auth";
import type { OrderStatus } from "@mm/lib/orders";
import { MAX_UPLOAD_BYTES } from "@mm/lib/products";

import type { UploadState } from "@/components/admin/useImageUploads";

const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

export const formatRupees = (amount: number) => amount.toLocaleString("en-US");

export const rupees = (amount: number) => `${formatRupees(amount)} rupees`;

const counted = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const itemCount = (count: number) => counted(count, "item");

const stockLabel = (stockCount: number) => (stockCount === 0 ? "Out of stock" : `${stockCount} in stock`);

const shippingCost = (cost: number) => (cost === 0 ? "Free" : rupees(cost));

const orderKind = (status?: OrderStatus) => (status ? `${status.toLowerCase()} ` : "");

export const malo = {
  cite: "Malo, owner",
  pageError: "Not my fault. Try again.",
  notFound: "Wrong aisle.",
  catalog: {
    intro: "Everything here is for sale. Pick something.",
    loadFailed: "Couldn't get the stock list. Not my fault.",
    empty: "Nothing on that shelf. Try another.",
    emptyInStock: "Nothing on that shelf right now. Come back after restocking."
  },
  productNotFound: "Never heard of it. Maybe Chudley sold it.",
  cart: {
    empty: "Empty. That's not how a store works.",
    loadFailed: "Lost track of your cart. Not my fault.",
    productsFailed: "Couldn't find what's in your cart. Probably the shelves."
  },
  checkout: {
    empty: "Nothing to check out. Bold strategy."
  },
  signIn: "Email. Code. Shop.",
  privacy:
    "The shop's pretend. Your email isn't. I keep what I need to run the place, nobody buys it off me, and you can close your account whenever you want.",
  terms:
    "Nothing here's real. Not the rupees, not the shipping. Don't feed the shop a real card, don't try to break it, and don't cry to me if it vanishes overnight.",
  credits: "Somebody had to make all this stuff. Wasn't me. I just sell it.",
  signUp: "No passwords. I don't trust you with one.",
  profile: {
    defaultsFailed: "Couldn't find your defaults. Not my fault.",
    closeAccount: "Leaving? Fine. Your addresses and cards go with you. No take-backs."
  },
  addresses: {
    loadFailed: "Couldn't find your addresses. Not my fault.",
    empty: "No addresses yet. Can't deliver to nowhere."
  },
  cards: {
    loadFailed: "Couldn't find your cards. Not my fault.",
    empty: "No cards on file. I don't do IOUs.",
    fakeNumbersOnly:
      "For the love of Hylia, please don't give me your actual credit card number! This is a pretend shop. Any 16 digits will do."
  },
  orders: {
    loadFailed: "Couldn't find your orders. Not my fault.",
    empty: "No orders yet. The shelves aren't going to empty themselves.",
    emptyForStatus: (status: OrderStatus) => `Nothing ${status.toLowerCase()}. Try another.`,
    orderMissing: "No order by that number. Check your orders.",
    orderFailed: "Couldn't find that order. Not my fault.",
    placed: (number: string) => `Order ${number} is in. Now go away so I can pack it.`
  }
};

export const chudley = {
  catalog: "You'll buy it now, if you're smart, at MAAAA-LOOOO MART!",
  notFound: "Nothing on this shelf! Not even dust!",
  signIn: "Welcome back, valued customer!",
  signUp: "Join the Malo Mart family! Membership is free!",
  orderPlaced: "Sold! A purchase for the ages!"
};

export const alerts = {
  loadMoreFailed: "Couldn't load more. Try again.",
  signOutFailed: "Couldn't sign you out. Try again.",
  auth: {
    sessionTimedOut: "That took too long. Start over.",
    invalidCode: "Wrong code. Check your email and try again.",
    expiredCode: "That code expired. Get a new one.",
    rateLimited: "Too many tries. Wait a few minutes.",
    accountExists: "There's already an account for that email.",
    failed: "Something broke. Try again.",
    newCodeSent: "New code sent.",
    accountConfirmed: "Account confirmed. Sign in to finish.",
    signedOutEverywhere: "Signed out on every device.",
    google: {
      cancelled: "Google sign-in cancelled.",
      failed: "Google sign-in didn't work. Try again or use your email.",
      wrongAccount: "That's a different Google account."
    } satisfies Record<GoogleSignInError, string>
  },
  cartAdjustments: {
    title: "I fixed your cart",
    soldOut: (title: string) => `${title} sold out, so I took it out.`,
    limited: (title: string, amount: number) => `${title}: only ${amount} left, so that's what you get.`,
    discontinued: (count: number) =>
      count === 1
        ? "Something in your cart isn't sold anymore, so I took it out."
        : `${count} things in your cart aren't sold anymore, so I took them out.`
  },
  checkout: {
    orderNotPlaced: "Order not placed",
    staleOrder: "Something changed while you were looking. I updated everything, so check it over and try again.",
    invalidOrder: "Something's off with your order. Check your address and card, then try again.",
    orderFailed: "Couldn't place your order. Try again.",
    chooseAddress: "Choose where this is going.",
    needAddress: "Add an address first. I need somewhere to send it.",
    chooseCard: "Choose a card to pay with.",
    needCard: "Add a card first. No rupees, no goods."
  },
  profile: {
    nameFailed: "Couldn't change your name. Try again.",
    sameEmail: "That's already your email.",
    signOutEverywhereFailed: "Couldn't sign you out everywhere. Try again.",
    googleDeletion: {
      cancelled: "Google check cancelled. Your account is still here.",
      failed: "Couldn't confirm with Google, so your account is still here. Try again.",
      wrongAccount: "That's a different Google account. Use the one you sign in with here."
    } satisfies Record<GoogleSignInError, string>
  },
  addresses: {
    gone: "That address is gone. Someone deleted it.",
    saveFailed: "Couldn't save that address. Try again.",
    makeDefaultFailed: "Couldn't change your default address. Try again.",
    deleteFailed: "Couldn't delete that address. Try again."
  },
  cards: {
    vaultRejected: "The vault didn't like that card. Check the details and try again.",
    gone: "That card is gone. Someone deleted it.",
    saveFailed: "Couldn't save that card. Try again.",
    makeDefaultFailed: "Couldn't change your default payment method. Try again.",
    removeFailed: "Couldn't remove that card. Try again.",
    chooseMonth: "Choose a month.",
    chooseYear: "Choose a year.",
    expired: "That card has expired."
  },
  orders: {
    cancelFailed: "Couldn't cancel the order. It may have already shipped."
  },
  admin: {
    ordersFailed: "Couldn't load orders.",
    productsFailed: "Couldn't load products.",
    productGone: "That product is gone. Someone deleted it.",
    productTooLarge: "That's too much text to store. Trim the description or features.",
    productSaveFailed: "Couldn't save the product. Try again.",
    deleteProductFailed: "Couldn't delete the product. Try again.",
    chooseCategory: "Choose a category.",
    enterPrice: "Enter a price.",
    enterOriginalPrice: "Enter the original price or leave it blank.",
    wholeRupees: "Use whole rupees.",
    atLeastOneRupee: "Has to be at least 1 rupee.",
    priceBelowOriginal: "The original price has to be higher than the price, or leave it blank.",
    enterStock: "Enter how many are in stock.",
    wholeNumber: "Use a whole number.",
    negativeStock: "Stock can't be negative.",
    stockAmountRange: (max: number) => `Enter a whole number from 1 to ${max.toLocaleString("en-US")}.`,
    stockFailed: "Couldn't change the stock. Try again.",
    thumbnailFailed: "Couldn't change the thumbnail. Try again.",
    deleteImageFailed: "Couldn't delete the image. Try again."
  }
};

export const toasts = {
  cart: {
    saveFailedTitle: "Couldn't save your cart",
    saveFailed: "It's back to how it was. Try again.",
    stillLoading: "Your cart is still loading. Try again in a moment.",
    allInStock: (title: string) => `Your cart already has every ${title} in stock.`,
    added: (title: string, amount: number) => `Added ${title} to your cart. ${amount} in cart.`,
    removed: (title: string) => `Removed ${title} from your cart.`,
    removedOne: (title: string, amount: number) => `Removed one ${title} from your cart. ${amount} in cart.`
  },
  admin: {
    created: (title: string) => `Created ${title}. Add some images next.`,
    saved: (title: string) => `Saved ${title}.`,
    deleted: (title: string) => `Deleted ${title}.`
  }
};

export const statusMessages = {
  catalogCount: (count: number, hasMore: boolean, category?: string) => {
    if (count === 0) {
      return "No products found.";
    }
    const products = `${hasMore ? "the first " : ""}${counted(count, "product")}`;
    return category ? `Showing ${products} in ${category}.` : `Showing ${products}.`;
  },
  profile: {
    nameUpdated: "Name updated.",
    emailUpdated: "Email updated."
  },
  addresses: {
    saved: (name: string) => `Saved ${name}.`,
    deleted: (name = "the address") => `Deleted ${name}.`,
    madeDefault: (name: string) => `${name} is now your default address.`,
    addedToOrder: (name: string) => `Added ${name} and picked it for this order.`
  },
  cards: {
    added: (name: string) => `Added ${name}.`,
    saved: (name: string) => `Saved ${name}.`,
    removed: (name = "the card") => `Removed ${name}.`,
    madeDefault: (name: string) => `${name} is now your default payment method.`,
    addedToOrder: (name: string) => `Added ${name} and picked it for this order.`
  },
  orders: {
    count: (count: number, hasMore: boolean, status?: OrderStatus) =>
      count === 0
        ? "No orders found."
        : `Showing ${hasMore ? "the first " : ""}${counted(count, `${orderKind(status)}order`)}.`,
    cancelled: "Order cancelled."
  },
  admin: {
    orderCount: (count: number, hasMore: boolean, status?: OrderStatus) =>
      count === 0
        ? "No orders found."
        : `Showing ${hasMore ? "the newest " : ""}${counted(count, `${orderKind(status)}order`)}.`,
    productCount: (count: number, hasMore: boolean) =>
      count === 0 ? "No products found." : `Showing ${hasMore ? "the first " : ""}${counted(count, "product")}.`,
    productDeleted: (title = "the product") => `Deleted ${title}.`,
    nothingChanged: "Nothing changed.",
    stockChanged: (change: number, stockCount: number) =>
      `${change > 0 ? "Added" : "Removed"} ${Math.abs(change)}. ${stockLabel(stockCount)} now.`,
    thumbnailUpdated: "Thumbnail updated. It's now image 1.",
    imageDeleted: (label = "the image") => `Deleted ${label}.`,
    uploads: {
      uploading: "Uploading…",
      processing: "Processing…",
      added: "Added.",
      duplicate: "Already one of this product's images.",
      rejected: "Couldn't read it as an image.",
      notImage: "Not an image file.",
      tooLarge: `Over the ${MAX_UPLOAD_MB} MB limit.`,
      timedOut: "Still processing. Check back in a minute.",
      failed: "Upload failed. Try again."
    } satisfies Record<UploadState, string>
  }
};

export const ui = {
  site: {
    name: "Malo Mart",
    formerlyPrefix: "Formerly ",
    formerName: "Chudley's Fine Goods and Fancy Trinkets Emporium",
    branch: "Castle Town branch",
    skipLink: "Skip to content",
    mainNav: "Main",
    shop: "Shop",
    cart: "Cart",
    cartWithCount: (count: number) => `Cart (${count})`,
    cartLabel: (count: number) => `Cart, ${itemCount(count)}`,
    backOffice: "Back office",
    account: "Account",
    signIn: "Sign in",
    signOut: "Sign out",
    siteNav: "Site info",
    privacy: "Privacy policy",
    terms: "Terms of service",
    credits: "Credits",
    footer: "Come back with more rupees.",
    builtBy: "Built by Sabelyn Thorpe.",
    sourceCode: "Code on GitHub",
    nintendo: "The Legend of Zelda belongs to Nintendo."
  },
  pageTitles: {
    pageError: "Something broke",
    notFound: "Not found",
    catalog: "Catalog",
    productNotFound: "Product not found",
    cart: "Cart",
    checkout: "Checkout",
    signIn: "Sign in",
    signUp: "Sign up",
    privacy: "Privacy policy",
    terms: "Terms of service",
    credits: "Credits",
    profile: "Your account",
    addresses: "Addresses",
    cards: "Payment methods",
    orders: "Orders",
    order: (number?: string) => (number ? `Order ${number}` : "Order"),
    orderPlaced: "Order placed",
    adminProducts: "Products · Back office",
    adminOrders: "Orders · Back office",
    adminNewProduct: "New product · Back office",
    adminProduct: (title = "Product") => `${title} · Back office`
  },
  common: {
    loading: "Loading…",
    close: "Close",
    cancel: "Cancel",
    tryAgain: "Try again",
    dismiss: "Dismiss",
    dismissNotification: "Dismiss notification",
    showMore: "Show more",
    all: "All",
    edit: "Edit",
    delete: "Delete",
    remove: "Remove",
    makeDefault: "Make default",
    defaultBadge: "Default",
    keepIt: "Keep it",
    statusPrefix: "Status: ",
    items: "Items",
    subtotal: "Subtotal",
    delivery: "Delivery",
    total: "Total",
    or: "or",
    itemCount,
    shippingCost,
    rupeesEach: (price: number) => `${rupees(price)} each`,
    rupeesTotal: (amount: number) => `${rupees(amount)} total`
  },
  pageError: {
    heading: "Something broke."
  },
  notFound: {
    backLink: "Back to the shop"
  },
  legal: {
    lastUpdated: (date: string) => `Last updated ${date}.`
  },
  privacy: {
    heading: "Privacy Policy",
    plainVersion: "That's Malo's version. The details below are the actual policy."
  },
  credits: {
    heading: "Credits"
  },
  terms: {
    heading: "Terms of Service",
    plainVersion: "That's Malo's version. The details below are the actual terms."
  },
  catalog: {
    eyebrow: "Catalog",
    filters: "Filters",
    category: "Category",
    hideSoldOut: "Hide sold-out items",
    productsHeading: "Products"
  },
  product: {
    breadcrumb: "Breadcrumb",
    catalog: "Catalog",
    editLink: "Edit product",
    notFoundHeading: "Not on the shelves",
    backToCatalog: "Back to the catalog",
    featuresHeading: "What it does",
    chudleyPrice: "Chudley's price:",
    sale: (percentOff: number) => `${percentOff}% off? Why not!`,
    noImage: "No picture. Use your imagination.",
    imagesGroup: "Product images",
    imageAlt: (title: string, index: number, total: number) =>
      total > 1 ? `${title}, image ${index} of ${total}` : title,
    showImage: (index: number, total: number) => `Show image ${index} of ${total}`,
    stock: (stockCount: number) => {
      if (stockCount === 0) {
        return "Sold out. Should've been faster.";
      }
      if (stockCount <= 3) {
        return `${stockCount} left. Decide.`;
      }
      return `${stockCount} in stock.`;
    }
  },
  cart: {
    heading: "Your cart",
    addToCart: "Add to cart",
    removeOne: (title: string) => `Remove one ${title}`,
    addOneMore: (title: string) => `Add one more ${title}`,
    inCart: (amount: number) => `${amount} in cart`,
    onlyLeft: (stockCount: number) => `Only ${stockCount} in stock.`,
    quantity: "Quantity",
    quantityOf: (title: string) => `Quantity of ${title}`,
    goShopping: "Go shopping",
    summary: "Summary",
    subtotalLabel: (subtotal: number) => `Subtotal: ${rupees(subtotal)}`,
    proceedToCheckout: "Proceed to checkout",
    membersOnly: "Members only at the register. House rules.",
    signInToCheckOut: "Sign in to check out",
    newHere: "New here?",
    createAccount: "Create an account"
  },
  checkout: {
    heading: "Checkout",
    shipTo: "Ship to",
    shippingAddress: "Shipping address",
    payWith: "Pay with",
    paymentCard: "Payment card",
    expiredCardsNote: "Expired cards can't be used.",
    expiredCardsLink: "Update them in your account",
    delivery: "Delivery",
    deliverySpeed: "Delivery speed",
    shippingOption: (description: string, cost: number) => `${description}. ${shippingCost(cost)}.`,
    yourItems: "Your items",
    editCart: "Edit cart",
    itemMeta: (amount: number, pricePerUnit: number) => `Quantity ${amount}, ${rupees(pricePerUnit)} each`,
    orderSummary: "Order summary",
    placeOrder: "Place order"
  },
  auth: {
    name: "Name",
    email: "Email",
    code: "Code",
    codeSent: (email: string) => `We emailed a code to ${email}.`,
    emailMeACode: "Email me a code",
    sendNewCode: "Send a new code",
    useDifferentEmail: "Use a different email",
    signIn: "Sign in",
    signInInstead: "Sign in instead",
    noCodeSignIn: "Didn't get a code? Sign in instead",
    confirmAccount: "Confirm account",
    newHere: "New here?",
    makeAccount: "Make an account",
    alreadyMember: "Already a member?",
    agreementPrefix: "By signing up, you agree to the",
    agreementJoiner: "and acknowledge the",
    continueWithGoogle: "Continue with Google"
  },
  account: {
    heading: "Your account",
    nav: "Account sections",
    sections: {
      profile: "Profile",
      addresses: "Addresses",
      cards: "Payment methods",
      orders: "Orders"
    }
  },
  profile: {
    heading: "Profile",
    defaults: "Defaults",
    devices: "Devices",
    closeAccount: "Close your account",
    deleteAccount: "Delete account",
    name: "Name",
    changeName: "Change name",
    email: "Email",
    changeEmail: "Change email",
    googleManagesEmail: "You sign in with Google, so Google manages this one.",
    shippingAddress: "Shipping address",
    paymentMethod: "Payment method",
    noneSet: "None set.",
    manageAddresses: "Manage addresses",
    manageCards: "Manage payment methods",
    signOutEverywhereBlurb:
      "Lost your Sheikah Slate? This signs you out here and everywhere else. Other devices can take up to 15 minutes to notice.",
    signOutEverywhere: "Sign out everywhere",
    changeNameTitle: "Change your name",
    saveName: "Save name",
    changeEmailTitle: "Change your email",
    newEmail: "New email",
    newEmailHint: (currentEmail: string) =>
      `Your current email, ${currentEmail}, keeps working until you confirm the new one.`,
    confirmNewEmail: "Confirm new email",
    deleteTitle: "Delete your account?",
    deleteWarning: (email: string) =>
      `This deletes your account, saved addresses, and payment methods. There's no undo. We'll email a code to ${email} to make sure it's really you.`,
    googleDeleteWarning:
      "This deletes your account, saved addresses, and payment methods. There's no undo. We'll send you to Google to make sure it's really you, and your account is deleted as soon as you're back.",
    deleteMyAccount: "Delete my account",
    keepMyAccount: "Keep my account",
    confirmWithGoogle: "Confirm with Google"
  },
  addresses: {
    heading: "Addresses",
    add: "Add an address",
    edit: (name: string) => `Edit ${name}`,
    label: "Label",
    labelHint: "Optional. Something like Home or Link's hideout.",
    recipient: "Recipient",
    street: "Street",
    city: "City",
    region: "Region",
    chooseRegion: "Choose a region",
    postalCode: "Postal code",
    makeDefault: "Make this my default address",
    save: "Save address",
    deleteTitle: "Delete this address?",
    deleteConfirm: "Delete address",
    deleteWarning: (name: string) => `${name} will be gone for good.`
  },
  cards: {
    heading: "Payment methods",
    add: "Add a card",
    edit: (name?: string) => (name ? `Edit ${name}` : "Edit card"),
    name: (brand: string, lastFour: string) => `${brand} ending in ${lastFour}`,
    expiry: (expired: boolean, expiration: string) => `${expired ? "Expired" : "Expires"} ${expiration}`,
    expiredBadge: "Expired",
    brand: "Card brand",
    number: "Card number",
    numberHint: "Goes straight to the vault. I never see it.",
    numberWarning: "Warning about card numbers",
    gotIt: "Got it",
    expirationMonth: "Expiration month",
    month: "Month",
    expirationYear: "Expiration year",
    year: "Year",
    editIntro: "Got a replacement card with the same number? Update the expiration here.",
    makeDefault: "Make this my default payment method",
    save: "Save card",
    removeTitle: "Remove this card?",
    removeConfirm: "Remove card",
    removeWarning: (name: string) => `${name} will be wiped from the vault.`
  },
  orders: {
    heading: "Orders",
    browseCatalog: "Browse the catalog",
    status: "Status",
    order: (number: string) => `Order ${number}`,
    placedOn: (date: string) => `Placed ${date}.`,
    listMeta: (date: string, count: number, recipient?: string) =>
      `${recipient ? `For ${recipient}. ` : ""}Placed ${date}. ${itemCount(count)}.`,
    updates: "Order updates",
    details: "Details",
    items: "Items",
    shipTo: "Ship to",
    delivery: "Delivery",
    paidWith: "Paid with",
    shippingSummary: (name: string, description: string, cost: number) =>
      `${name}, ${description.toLowerCase()}. ${shippingCost(cost)}.`,
    notYet: "Not yet.",
    stepNotes: {
      Placed: "Got your order.",
      Confirmed: "Payment cleared. Packing it now.",
      Shipped: "It left the shop. Out of my hands.",
      Delivered: "Dropped off. Enjoy it, or don't.",
      Cancelled: "Cancelled. Nothing ships."
    } satisfies Record<OrderStatus, string>,
    declinedNote: "Payment declined. Nothing ships.",
    cancel: "Cancel order",
    cancelTitle: "Cancel this order?",
    keepOrder: "Keep order",
    cancelWarning: (number: string) => `Order ${number} won't ship. No take-backs.`,
    allYourOrders: "All your orders",
    allOrders: "All orders",
    yourOrders: "Your orders",
    loadErrorHeading: "Order",
    placedDetails: "The details",
    orderNumber: "Order number",
    placedTotal: (total: number, count: number) => `${rupees(total)} for ${itemCount(count)}`,
    whatYouBought: "What you bought",
    viewDetails: "View order details",
    keepShopping: "Keep shopping"
  },
  admin: {
    heading: "Back office",
    nav: "Back office sections",
    sections: {
      products: "Products",
      orders: "Orders"
    },
    ordersHeading: "Orders",
    productsHeading: "Products",
    newProduct: "New product",
    allProducts: "All products",
    category: "Category",
    allCategories: "All categories",
    stockFilter: "Stock",
    stockFilters: {
      all: "All",
      inStock: "In stock",
      outOfStock: "Out of stock"
    },
    stockLabel,
    priceLabel: (price: number, originalPrice?: number | null) =>
      originalPrice ? `${rupees(price)}, down from ${formatRupees(originalPrice)}` : rupees(price),
    noImages: "No images.",
    deleteTitle: (title = "this product") => `Delete ${title}?`,
    deleteConfirm: "Delete product",
    deleteFromListWarning: "It comes out of the catalog along with its images. Past orders keep its name.",
    productNotFound: "Product not found",
    productMaybeDeleted: "It may have been deleted.",
    editTitle: (title: string) => `Edit ${title}`,
    viewInShop: "View in the shop",
    details: "Details",
    stock: "Stock",
    images: "Images",
    deleteSection: "Delete product",
    deleteSectionBlurb: "Takes it out of the catalog and deletes its images. Past orders keep its name.",
    deleteButton: (title: string) => `Delete ${title}`,
    noUndo: "There's no undo.",
    form: {
      title: "Title",
      category: "Category",
      chooseCategory: "Choose a category",
      description: "Description",
      descriptionCount: (length: number, max: number) => `${length} of ${max} characters.`,
      price: "Price",
      priceHint: "In rupees.",
      originalPrice: "Original price",
      originalPriceHint: "Optional. Set it above the price to put the product on sale.",
      startingStock: "Starting stock",
      features: "Features",
      feature: (number: number) => `Feature ${number}`,
      removeFeature: (number: number) => `Remove feature ${number}`,
      addFeature: "Add a feature",
      saveChanges: "Save changes",
      create: "Create product"
    },
    stockAmount: "Amount",
    addStock: "Add stock",
    removeStock: "Remove stock",
    imagesEmpty: "No images yet. The catalog shows a blank placard until you add one.",
    imageLabel: (number: number) => `Image ${number}`,
    thumbnail: "Thumbnail",
    addImages: "Add images",
    addImagesHint: `PNG, JPEG, WebP, or GIF up to ${MAX_UPLOAD_MB} MB each. Big ones are resized.`,
    chooseFiles: "Choose files",
    uploads: "Uploads",
    upload: (name: string, state: UploadState) => `${name}: ${statusMessages.admin.uploads[state]}`,
    clearUploads: "Clear the upload list",
    deleteImageTitle: (label = "this image") => `Delete ${label}?`,
    deleteImageConfirm: "Delete image",
    deleteThumbnailWarning: "It's the thumbnail, so the product goes without one until you pick another.",
    deleteImageWarning: "It's removed from the product page right away."
  }
};

import { Container, SimpleGrid, Title } from "@mantine/core";
import { Category } from "@mm/lib/products";
import type { Product } from "@mm/lib/products";
import { useState } from "react";

import arrowsImage from "@/assets/items/arrows.png";
import bombsImage from "@/assets/items/bombs.png";
import hylianShieldImage from "@/assets/items/hylian-shield.png";
import magicArmorImage from "@/assets/items/magic-armor.png";
import redPotionImage from "@/assets/items/red-potion.png";
import ProductPlacard from "@/components/ProductPlacard";
import SiteHeader from "@/components/SiteHeader";
import classes from "./App.module.css";

type ShelfItem = { product: Product; image?: string; chudleyPrice?: number };

const sampleShelf: ShelfItem[] = [
  {
    product: {
      id: "c3e8a1f2-7b4d-4e9a-8f1c-6d2b5a9e3f00",
      title: "Magic Armor",
      description: "Take no damage. Your rupees take it instead. Keep your wallet full.",
      category: Category.Armor,
      price: 598,
      inStock: 1
    },
    image: magicArmorImage,
    chudleyPrice: 1000000
  },
  {
    product: {
      id: "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01",
      title: "Hylian Shield",
      description: "Sturdy, fireproof, and no longer priced like a castle.",
      category: Category.Shields,
      price: 200,
      inStock: 2
    },
    image: hylianShieldImage,
    chudleyPrice: 20000
  },
  {
    product: {
      id: "9b7e2f4a-1c3d-4e5f-8a9b-0c1d2e3f4a02",
      title: "Red Potion",
      description: "Restores eight hearts. Tastes like it.",
      category: Category.Potions,
      price: 30,
      inStock: 14
    },
    image: redPotionImage,
    chudleyPrice: 300
  },
  {
    product: {
      id: "2f6c8e0a-4b2d-4f6e-9c8a-1b3d5f7e9a03",
      title: "Arrows (30)",
      description: "Thirty arrows. Pointy end goes toward the Bulblin.",
      category: Category.Arrows,
      price: 40,
      inStock: 0
    },
    image: arrowsImage
  },
  {
    product: {
      id: "7a1b3c5d-6e7f-4a8b-9c0d-2e4f6a8b0c04",
      title: "Bombs (10)",
      description: "Handle with care. No refunds on detonated goods.",
      category: Category.Bombs,
      price: 50,
      inStock: 6
    },
    image: bombsImage,
    chudleyPrice: 1000
  }
];

const App = () => {
  const [cartCount, setCartCount] = useState(0);

  return (
    <>
      <SiteHeader cartCount={cartCount} />
      <main>
        <Container size="lg">
          <section className={classes.hero}>
            <Title order={1} className={classes.hype}>
              You'll buy it now, if you're smart, at MAAAA-LOOOO MART!
            </Title>
            <figure className={classes.malo}>
              <blockquote>Buy something already.</blockquote>
              <figcaption>
                <cite>Malo, owner</cite>
              </figcaption>
            </figure>
          </section>
          <section aria-labelledby="shelf-heading">
            <Title order={2} id="shelf-heading" className={classes.shelfHeading}>
              On the shelves
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xl" verticalSpacing="xl">
              {sampleShelf.map(({ product, image, chudleyPrice }) => (
                <ProductPlacard
                  key={product.id}
                  product={product}
                  image={image}
                  chudleyPrice={chudleyPrice}
                  onAddToCart={() => setCartCount((count) => count + 1)}
                />
              ))}
            </SimpleGrid>
          </section>
        </Container>
      </main>
      <footer className={classes.footer}>
        <Container size="lg">
          <p>Come back with more rupees.</p>
          <p className={classes.credits}>
            Item icons ripped by Colbydude. Rupee art by Side__Steppa. The Legend of Zelda belongs to Nintendo.
          </p>
        </Container>
      </footer>
    </>
  );
};

export default App;

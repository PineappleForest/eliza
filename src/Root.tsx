import React from "react";
import { Composition } from "remotion";
import { ElizaShort, ELIZA_FRAMES } from "./videos/eliza/Eliza";
import { RentalShort, RENTAL_FRAMES } from "./videos/rental/Rental";
import { ChatShort, CHAT_FRAMES } from "./videos/chat/Chat";
import { MinisterShort, MINISTER_FRAMES } from "./videos/minister/Minister";
import { SwedenShort, SWEDEN_FRAMES } from "./videos/sweden/Sweden";
import { MonowiShort, MONOWI_FRAMES } from "./videos/monowi/Monowi";
import { CardsShort, CARDS_FRAMES } from "./videos/cards/Cards";
export const Root: React.FC = () => (<>
  <Composition id="ElizaShort" component={ElizaShort} durationInFrames={ELIZA_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="RentalShort" component={RentalShort} durationInFrames={RENTAL_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="ChatShort" component={ChatShort} durationInFrames={CHAT_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="MinisterShort" component={MinisterShort} durationInFrames={MINISTER_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="SwedenShort" component={SwedenShort} durationInFrames={SWEDEN_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="MonowiShort" component={MonowiShort} durationInFrames={MONOWI_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="CardsShort" component={CardsShort} durationInFrames={CARDS_FRAMES} fps={30} width={1080} height={1920} />
</>);

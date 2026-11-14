import React from "react";
import { Composition } from "remotion";
import { ElizaShort, ELIZA_FRAMES } from "./videos/eliza/Eliza";
import { RentalShort, RENTAL_FRAMES } from "./videos/rental/Rental";
import { ChatShort, CHAT_FRAMES } from "./videos/chat/Chat";
import { MinisterShort, MINISTER_FRAMES } from "./videos/minister/Minister";
import { SwedenShort, SWEDEN_FRAMES } from "./videos/sweden/Sweden";
import { MonowiShort, MONOWI_FRAMES } from "./videos/monowi/Monowi";
import { CardsShort, CARDS_FRAMES } from "./videos/cards/Cards";
import { PastaShort, PASTA_FRAMES } from "./videos/pasta/Pasta";
import { VoyagerShort, VOYAGER_FRAMES } from "./videos/voyager/Voyager";
import { PigsShort, PIGS_FRAMES } from "./videos/pigs/Pigs";
import { TowerShort, TOWER_FRAMES } from "./videos/tower/Tower";
import { NothingShort, NOTHING_FRAMES } from "./videos/nothing/Nothing";
import { WhaleShort, WHALE_FRAMES } from "./videos/whale/Whale";
export const Root: React.FC = () => (<>
  <Composition id="ElizaShort" component={ElizaShort} durationInFrames={ELIZA_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="RentalShort" component={RentalShort} durationInFrames={RENTAL_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="ChatShort" component={ChatShort} durationInFrames={CHAT_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="MinisterShort" component={MinisterShort} durationInFrames={MINISTER_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="SwedenShort" component={SwedenShort} durationInFrames={SWEDEN_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="MonowiShort" component={MonowiShort} durationInFrames={MONOWI_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="CardsShort" component={CardsShort} durationInFrames={CARDS_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="PastaShort" component={PastaShort} durationInFrames={PASTA_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="VoyagerShort" component={VoyagerShort} durationInFrames={VOYAGER_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="PigsShort" component={PigsShort} durationInFrames={PIGS_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="TowerShort" component={TowerShort} durationInFrames={TOWER_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="NothingShort" component={NothingShort} durationInFrames={NOTHING_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="WhaleShort" component={WhaleShort} durationInFrames={WHALE_FRAMES} fps={30} width={1080} height={1920} />
</>);

import React from "react";
import { Composition } from "remotion";
import { ElizaShort, ELIZA_FRAMES } from "./videos/eliza/Eliza";
import { RentalShort, RENTAL_FRAMES } from "./videos/rental/Rental";
import { ChatShort, CHAT_FRAMES } from "./videos/chat/Chat";
export const Root: React.FC = () => (<>
  <Composition id="ElizaShort" component={ElizaShort} durationInFrames={ELIZA_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="RentalShort" component={RentalShort} durationInFrames={RENTAL_FRAMES} fps={30} width={1080} height={1920} />
      <Composition id="ChatShort" component={ChatShort} durationInFrames={CHAT_FRAMES} fps={30} width={1080} height={1920} />
</>);

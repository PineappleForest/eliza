import React from "react";
import { Composition } from "remotion";
import { ElizaShort, ELIZA_FRAMES } from "./videos/eliza/Eliza";
export const Root: React.FC = () => (<>
  <Composition id="ElizaShort" component={ElizaShort} durationInFrames={ELIZA_FRAMES} fps={30} width={1080} height={1920} />
</>);

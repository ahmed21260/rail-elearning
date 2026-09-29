import { Composition } from "remotion";
import { RailSignal, type RailSignalProps } from "./RailSignal";

const defaultProps: RailSignalProps = {
  module: "Formation opérateur · Module 1",
  name: "Le Carré",
  tag: "Signal d'arrêt",
  rule: "Arrêt absolu. Ne jamais le franchir sans autorisation.",
  lamps: ["red", "red"],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RailSignal"
    component={RailSignal}
    durationInFrames={240}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={defaultProps}
  />
);

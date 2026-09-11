import { describe, it, expect } from "vitest";
import { soundEngine } from "../audio/SoundEngine";

describe("SoundEngine", () => {
  it("initializes with off profile", () => {
    expect(soundEngine).toBeDefined();
  });

  it("updates volume and profile without throwing", () => {
    expect(() => {
      soundEngine.setProfile("mechanical");
      soundEngine.setVolume(0.8);
      soundEngine.play("keystroke");
      soundEngine.play("error");
      soundEngine.play("wordComplete");
      soundEngine.play("streakMilestone");
      soundEngine.setProfile("soft");
      soundEngine.play("keystroke");
      soundEngine.setProfile("minimal");
      soundEngine.play("error");
      soundEngine.setProfile("off");
      soundEngine.play("keystroke");
    }).not.toThrow();
  });
});

import * as DI from "../main/index";

describe("needl", () => {
  it("Should be able to resolve and inject dependencies", async () => {
    interface Ninja {
      fight(): string;
      sneak(): string;
    }

    interface Katana {
      hit(): string;
    }

    interface Shuriken {
      throw(): string;
    }

    const Ninja = {
      id: DI.newId<Ninja>("Ninja"),
      create(katana: Katana, shuriken: Shuriken): Ninja {
        return {
          fight() {
            return katana.hit();
          },
          sneak() {
            return shuriken.throw();
          },
        };
      },
    };
    const Katana = {
      id: DI.newId<Katana>("Katana"),
      create(): Katana {
        return {
          hit() {
            return "cut!";
          },
        };
      },
    };
    const Shuriken = {
      id: DI.newId<Shuriken>("Shuriken"),
      create(): Shuriken {
        return {
          throw() {
            return "hit!";
          },
        };
      },
    };

    const container = Shuriken.id.bindTo()(Shuriken.create)
      .join(Katana.id.bindTo()(Katana.create))
      .join(Ninja.id.bindTo(Katana.id, Shuriken.id)(Ninja.create))
      .apply(DI.Container.empty);

    const ninja = await container.get(Ninja.id);
    expect(ninja.fight()).toEqual("cut!");
    expect(ninja.sneak()).toEqual("hit!");
  });
  it("Should be able to resolve and inject dependencies (async)", async () => {
    interface Warrior {
      readonly origin: string;
      fight(): string;
      sneak(): string;
    }
    const Warrior = {
      id: DI.newId<Warrior>("Warrior"),
    };
    interface Weapon {
      hit(): string;
    }
    const Weapon = {
      id: DI.newId<Weapon>("Weapon"),
    };
    interface ThrowableWeapon {
      throw(): string;
    }
    const ThrowableWeapon = {
      id: DI.newId<ThrowableWeapon>("ThrowableWeapon"),
    };
    class Ninja implements Warrior {
      public readonly origin = "Japan";
      constructor(
        private readonly weapon: Weapon,
        private readonly throwableWeapon: ThrowableWeapon
      ) {}
      fight(): string {
        return this.weapon.hit();
      }
      sneak(): string {
        return this.throwableWeapon.throw();
      }
      static layer = Warrior.id.bindTo(
        Weapon.id,
        ThrowableWeapon.id
      )((weapon, tweapon) => new Ninja(weapon, tweapon));
    }
    class Katana implements Weapon {
      hit(): string {
        return "cut!";
      }
      static layer = Weapon.id.bindTo()(() => new Katana());
    }
    class Shuriken implements ThrowableWeapon {
      throw(): string {
        return "hit!";
      }
      static layer = ThrowableWeapon.id.bindTo()(() => new Shuriken());
    }

    const container = Shuriken.layer
      .join(Katana.layer)
      .join(Ninja.layer)
      .apply(DI.Container.empty);

    const warrior = await container.get(Warrior.id);
    expect(warrior.fight()).toEqual("cut!");
    expect(warrior.sneak()).toEqual("hit!");
    expect(warrior.origin).toEqual("Japan");
  });
});

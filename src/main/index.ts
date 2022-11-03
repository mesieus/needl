
type Provider<T> = () => Promise<T>;

type Binding<Deps extends Tag<any>[], T> = {
  override: boolean;
  deps: Deps;
  creator: Creator<Vals<Deps>, T>;
};
type TaggedBinding<Deps extends Tag<any>[], T> = Binding<Deps, T> & {
  override: boolean;
  tag: Tag<T>;
};

const memoizedProvider = <T>(fn: Provider<T>): Provider<T> => {
  let component: Promise<T> | null = null;
  return () => {
    if (component != null) {
      return component;
    } else {
      component = fn();
      return component;
    }
  };
};

export type LayerUses<Mod extends Layer<any, never>> = Mod extends Layer<
  infer Uses,
  never
>
  ? Uses
  : any;
export type LayerMakes<Mod extends Layer<any, never>> = Mod extends Layer<
  any,
  infer Makes
>
  ? Makes
  : never;

/**
 * A provider is a recipe that expresses how to build an Ouput, given an Input
 * the underlying backing type is an async function that goes from input
 * to Output
 */
export class Layer<
  out Uses, //inveresed variance works better
  in Makes
> {
  constructor(readonly bindings: TaggedBinding<Tag<unknown>[], unknown>[]) {}

  /**
   * This concatenates two layers
   * where the second depends on the first
   * @param other
   * @returns
   */
  join<Uses2, Makes2>(
    other: Layer<Uses2, Makes2>
  ): Layer<Uses | Exclude<Uses2, Makes>, Makes | Makes2> {
    return new Layer([...this.bindings, ...other.bindings]);
  }
  apply(app: Container<Uses>): Container<Makes> {
    const layer: Layer<Uses, Makes> = this;
    let rawContainer = app.raw;
    for (const binding of layer.bindings) {
      const currentContainer = rawContainer;

      if (binding.override || !(binding.tag.key in rawContainer)) {
        const provider = memoizedProvider(async () => {
          console.log(`requesting component ${binding.tag.name}`);
          const deps = await Promise.all(
            binding.deps.map((tag) => {
              if (tag.key in currentContainer) {
                return currentContainer[tag.key];
              } else
                throw new Error(
                  `Requested ${tag.name}, but it is not in container`
                );
            })
          );
          const component = await Promise.resolve(binding.creator(...deps));
          console.log(`component ${binding.tag.name} was created`);
          return component;
        });
        rawContainer = {
          ...currentContainer,
          [binding.tag.key]: provider,
        };
      }
    }
    return new Container(rawContainer);
  }
  static empty = new Layer<never, never>([]);
}

/**
 * The core
 */
export class Container<in Of> {
  constructor(readonly raw: { [k in symbol]: Provider<unknown> }) {}

  /**
   * Do not use this method
   */
  take(of: Of) {
    throw new Error();
  }
  async get<T>(tag: Of extends Tag<T> ? Tag<T> : never): Promise<T> {
    if (tag.key in this.raw) {
      return this.raw[tag.key]() as Promise<T>;
    } else throw new Error(`Requested ${tag.name}, but it is not in container`);
  }
  static empty: Container<never> = new Container({});
}

/**
 * A typed function that takes multiple parameters (From)
 * and creates an instance of To
 */
type Creator<From extends any[], To> = (...deps: From) => Promise<To> | To;
/**
 * A type-level function that unwraps Tags...
 *  TagToParam<Tag<X>> => X
 *  Is the inverse of Tag<X>
 */
type Val<T extends Tag<any>> = T extends Tag<infer Of> ? Of : never;
/**
 * Unwraps a tuple of tags
 * ie [Tag<A>,Tag<B>] => [A, B]
 */
type Vals<Tags extends Tag<any>[]> = Tags extends [
  infer Head extends Tag<any>,
  ...infer Tail extends Tag<any>[]
]
  ? [Val<Head>, ...Vals<Tail>]
  : Tags extends []
  ? []
  : Tags extends Tag<infer C>[]
  ? C[]
  : never;

type UniteTags<Tags extends Tag<any>[]> = Tags extends [
  infer Head extends Tag<any>,
  ...infer Tail extends Tag<any>[]
]
  ? Head | UniteTags<Tail>
  : Tags extends never[]
  ? never
  : Tags extends Tag<infer C>[]
  ? Tag<C>
  : never;

/**
 * The core behind this DI system
 * Every tag is backed by a symbol that is used to add
 * dependencies to the DI container, and also get them out of the DI container.
 */
export class Tag<Of> {
  readonly key: symbol;
  constructor(readonly name: string) {
    this.key = Symbol(name);
  }

  bindTo<Deps extends Tag<any>[]>(
    ...deps: Deps
  ): (
    creator: Creator<Vals<Deps>, Of>,
    override?: boolean
  ) => Layer<UniteTags<Deps>, Tag<Of>> {
    return (creator, override) => {
      const tbinding: TaggedBinding<Deps, Of> = {
        tag: this,
        deps,
        creator,
        override: !!override,
      };
      const ubinding: TaggedBinding<Tag<unknown>[], unknown> = {
        tag: tbinding.tag as Tag<unknown>,
        deps: tbinding.deps,
        creator: tbinding.creator as Creator<unknown[], unknown>,
        override: tbinding.override,
      };
      return new Layer([ubinding]);
    };
  }
}

/**
 *
 * @returns
 */
export const newTag = <S>(name: string) => new Tag<S>(name);

// === Experimental ideas, please do not delete
/**
 * Marker class again, it's awesome
 */
class As<out T> {
  constructor(public readonly name: string) {}
  cast(any: any): T {
    return any as T;
  }
}

const as = <T>(name: string): As<T> => new As<T>(name);

const globalRegistry: Record<symbol, Tag2<symbol, any>> = {};

class Tag2<Key extends symbol, Component> {
  constructor(public readonly key: Key, private readonly as: As<Component>) {
    if (key in globalRegistry) {
      throw new Error(
        "There's already a tag for this symbol: " + globalRegistry[key]
      );
    } else {
      globalRegistry[key] = this;
    }
  }
  add<T extends {}>(
    into: T,
    it: Component
  ): T & {
    [key in Key]: Component;
  } {
    return { ...into, [this.key]: it };
  }
  get<
    T extends {
      [key in Key]: Component;
    }
  >(t: T): Component {
    return t[this.key];
  }
}

const newTag2 = <Key extends symbol, Component>(key: Key, as: As<Component>) =>
  new Tag2(key, as);

/*
// IF YOU MODIFY THIS FILE, UNCOMMENT THIS 
// AND CHECK IF COMMENTS BELOW FIT THE COMPILER BEHAVIOUR
const numberTag = newTag<number>("number");
const stringTag = newTag<string>("string");
const booleanTag = newTag<boolean>("boolean");


const numberLayer1 = numberTag.layer()(() => 3);
const booleanLayer1 = booleanTag.layer(
  numberTag,
  stringTag
)((number, string) => true);
const stringLayer1 = stringTag.layer()(() => "Hola");

numberLayer1.compose(booleanLayer1); //this should fail to compile
numberLayer1.compose(stringLayer1); //this should compile
numberLayer1.compose(stringLayer1).compose(booleanLayer1); // this should compile

emptyContainer.withLayer(booleanLayer1); //this should fail to compile
emptyContainer.withLayer(stringLayer1).withLayer(booleanLayer1); // this should fail to compile
emptyContainer
  .withLayer(stringLayer1)
  .withLayer(numberLayer1)
  .withLayer(booleanLayer1); // this should compile

*/

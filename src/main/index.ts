type Provider<T> = () => Promise<T>;

type Binding<Deps extends Id<any>[], T> = {
  override: boolean;
  deps: Deps;
  creator: Creator<Vals<Deps>, T>;
};
type BindingWithId<Deps extends Id<any>[], T> = Binding<Deps, T> & {
  override: boolean;
  id: Id<T>;
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
  constructor(readonly bindings: BindingWithId<Id<unknown>[], unknown>[]) {}

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

      if (binding.override || !(binding.id.key in rawContainer)) {
        const provider = memoizedProvider(async () => {
          console.log(`requesting component ${binding.id.name}`);
          const deps = await Promise.all(
            binding.deps.map((id) => {
              if (id.key in currentContainer) {
                return currentContainer[id.key]();
              } else
                throw new Error(
                  `Requested ${id.name}, but it is not in container`
                );
            })
          );
          const component = await Promise.resolve(binding.creator(...deps));
          console.log(`component ${binding.id.name} was created`);
          return component;
        });
        rawContainer = {
          ...currentContainer,
          [binding.id.key]: provider,
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
  async get<T>(id: Of extends Id<T> ? Id<T> : never): Promise<T> {
    if (id.key in this.raw) {
      return this.raw[id.key]() as Promise<T>;
    } else throw new Error(`Requested ${id.name}, but it is not in container`);
  }
  static empty: Container<never> = new Container({});
}

/**
 * A typed function that takes multiple parameters (From)
 * and creates an instance of To
 */
type Creator<From extends any[], To> = (...deps: From) => Promise<To> | To;
/**
 * A type-level function that unwraps Ids...
 *  IdToParam<Id<X>> => X
 *  Is the inverse of Id<X>
 */
type Val<T extends Id<any>> = T extends Id<infer Of> ? Of : never;
/**
 * Unwraps a tuple of ids
 * ie [Id<A>,Id<B>] => [A, B]
 */
type Vals<Ids extends Id<any>[]> = Ids extends [
  infer Head extends Id<any>,
  ...infer Tail extends Id<any>[]
]
  ? [Val<Head>, ...Vals<Tail>]
  : Ids extends []
  ? []
  : Ids extends Id<infer C>[]
  ? C[]
  : never;

type UniteIds<Ids extends Id<any>[]> = Ids extends [
  infer Head extends Id<any>,
  ...infer Tail extends Id<any>[]
]
  ? Head | UniteIds<Tail>
  : Ids extends never[]
  ? never
  : Ids extends Id<infer C>[]
  ? Id<C>
  : never;

/**
 * The core behind this DI system
 * Every id is backed by a symbol that is used to add
 * dependencies to the DI container, and also get them out of the DI container.
 */
export class Id<Of> {
  readonly key: symbol;
  constructor(readonly name: string) {
    this.key = Symbol(name);
  }

  bindTo<Deps extends Id<any>[]>(
    ...deps: Deps
  ): (
    creator: Creator<Vals<Deps>, Of>,
    override?: boolean
  ) => Layer<UniteIds<Deps>, Id<Of>> {
    return (creator, override) => {
      const tbinding: BindingWithId<Deps, Of> = {
        id: this,
        deps,
        creator,
        override: !!override,
      };
      const ubinding: BindingWithId<Id<unknown>[], unknown> = {
        id: tbinding.id as Id<unknown>,
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
export const newId = <S>(name: string) => new Id<S>(name);

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

const globalRegistry: Record<symbol, Id2<symbol, any>> = {};

class Id2<Key extends symbol, Component> {
  constructor(public readonly key: Key, private readonly as: As<Component>) {
    if (key in globalRegistry) {
      throw new Error(
        "There's already a id for this symbol: " + globalRegistry[key]
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

const newId2 = <Key extends symbol, Component>(key: Key, as: As<Component>) =>
  new Id2(key, as);

/*
// IF YOU MODIFY THIS FILE, UNCOMMENT THIS 
// AND CHECK IF COMMENTS BELOW FIT THE COMPILER BEHAVIOUR
const numberId = newId<number>("number");
const stringId = newId<string>("string");
const booleanId = newId<boolean>("boolean");


const numberLayer1 = numberId.layer()(() => 3);
const booleanLayer1 = booleanId.layer(
  numberId,
  stringId
)((number, string) => true);
const stringLayer1 = stringId.layer()(() => "Hola");

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

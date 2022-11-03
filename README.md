# Needl

Needl is a Typescript library for dependency injection, that exploits everything that Typescript's typesystem has to offer, in order to have an ergonomic and typesafe DI mechanism that doesn't depend on 
reflect metadata.

## About

Needl is a lightweight DI container for Typescript apps (both front end and back end). It allows you to safely
wire all your app parts, and exploits Typescript's typesystem to show missing dependencies during compile time.


## Motivation

Most languages exploit reflection to create idiomatic DI containers. Due to the fact that little to no reflection exists in Javascript (it exists exclusive to classes), most DI libraries associate injectables with either classes (using reflect metadata), strings (like Awilix) or untyped symbols (like InversifyJS).

That ends up in two big problems:

1. Container is not typesafe, and missing dependencies can only be known during tests or runtime, AND you require extra type annotations (which can be wrong) in injected components... and
2. Adoption becomes difficult as not everything that you wish to be injectable is a class (that's specially true for DI frameworks that depend on metadata)
3. Not a big one, but there are some injectables that are constructed asyncly. Most DI frameworks (AFAIK) lack support for this case. Not Needl


## Philosophy

Needl has been developed with 2 main goals:

1. Easy to adopt (specially for big codebases)
2. Typesafe
3. Ergonomic
4. Support for async constructors

## Installation

## The Basics

### Step 1: Declare your injectables

```typescript

type MyService = {
    doSomething()
}
type MyDAO = {
    storeText(text:string):Promise<void>
}
type MyClient = {
    consultText():Promise<string>
}
```
Needl needs tags as identifiers at runtime. These tags are typesafe...

```typescript
const MyService = {
    tag: newTag<MyService>("MyService")
}
const MyDAO = {
    tag: newTag<MyDAO>("MyDAO")
}
const MyClient = {
    tag: newTag<MyClient>("MyClient")
}
```
### Step 2: Implement and declare dependencies

```typescript

class MyDefaultService extends MyService{
    constructor(myDAO:MyDAO, myClient:MyClient){
        this.myDAO = myDAO
        this.myClient = myClient
    }
    async doSomething(){
        const text = await this.myClient.consultText()
        await this.myDAO.storeText(text)
    }
    static layer = MyService.tag.bindTo(MyDAO.tag,MyClient.tag)(
        (myDAO,myClient) => new MyDefaultService(myDAO,myClient)
    )
}

const createMyGreetingClient = () => ({
    consultText: async () => "Hello World"
})
const MyGreetingClient = {
    layer: MyClient.tag.bindTo()(createMyGreetingClient)
}
const createMyInMemDAO = () => {
    const mem = []
    return {
        async storeText(text:string){
            mem.push(text)
        }
        printMem(){
            console.log(mem)
        }
    }
}

const MyInMemDAO = {
    layer: MyDAO.tag.bindTo()(createMyInMemDAO)
}

```

### Step 3: Configure Container and resolve dependencies!

```typescript
const myContainer = MyInMemDAO.layer
    .concat(MyGreetingClient.layer)
    .concat(MyDefaultService.layer)
    .apply(Container.empty)

const myService = await myContainer.get(MyService.tag)
const myDAO = await myContainer.get(MyDAO.tag)
await myService.doSomething()

(myDAO as any).printMem() // prints ["Hello World"]

```

Enjoy!

## Circular dependencies

NOPE! Nor won't happen. If you need them, you probably have some serious design problems that you'd have to solve first.

There's one very simple strategy to overcome such "limitation" (which I'd actually call feature), and maybe later I'll add some example




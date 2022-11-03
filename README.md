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

1. Easy to adopt
2. Typesafe
3. Ergonomic
4. Support for async constructors

## Installation

## The Basics

### Step 1: Declare your injectables

```typescript
``` 



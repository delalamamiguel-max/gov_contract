# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListOpportunities*](#listopportunities)
  - [*ListPipelineApplications*](#listpipelineapplications)
- [**Mutations**](#mutations)
  - [*CreatePipelineApplication*](#createpipelineapplication)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@govcontract/dataconnect` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@govcontract/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@govcontract/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListOpportunities
You can execute the `ListOpportunities` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listOpportunities(options?: ExecuteQueryOptions): QueryPromise<ListOpportunitiesData, undefined>;

interface ListOpportunitiesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListOpportunitiesData, undefined>;
}
export const listOpportunitiesRef: ListOpportunitiesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listOpportunities(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListOpportunitiesData, undefined>;

interface ListOpportunitiesRef {
  ...
  (dc: DataConnect): QueryRef<ListOpportunitiesData, undefined>;
}
export const listOpportunitiesRef: ListOpportunitiesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listOpportunitiesRef:
```typescript
const name = listOpportunitiesRef.operationName;
console.log(name);
```

### Variables
The `ListOpportunities` query has no variables.
### Return Type
Recall that executing the `ListOpportunities` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListOpportunitiesData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListOpportunitiesData {
  opportunities: ({
    id: UUIDString;
    noticeId: string;
    title: string;
    agency: string;
    solicitationNumber?: string | null;
    naicsCode?: string | null;
    setAsideType?: string | null;
    postedDate: TimestampString;
    responseDeadline?: TimestampString | null;
    estimatedValue?: number | null;
    sourceUrl: string;
  } & Opportunity_Key)[];
}
```
### Using `ListOpportunities`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listOpportunities } from '@govcontract/dataconnect';


// Call the `listOpportunities()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listOpportunities();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listOpportunities(dataConnect);

console.log(data.opportunities);

// Or, you can use the `Promise` API.
listOpportunities().then((response) => {
  const data = response.data;
  console.log(data.opportunities);
});
```

### Using `ListOpportunities`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listOpportunitiesRef } from '@govcontract/dataconnect';


// Call the `listOpportunitiesRef()` function to get a reference to the query.
const ref = listOpportunitiesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listOpportunitiesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.opportunities);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.opportunities);
});
```

## ListPipelineApplications
You can execute the `ListPipelineApplications` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listPipelineApplications(vars: ListPipelineApplicationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;

interface ListPipelineApplicationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListPipelineApplicationsVariables): QueryRef<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
}
export const listPipelineApplicationsRef: ListPipelineApplicationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listPipelineApplications(dc: DataConnect, vars: ListPipelineApplicationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;

interface ListPipelineApplicationsRef {
  ...
  (dc: DataConnect, vars: ListPipelineApplicationsVariables): QueryRef<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
}
export const listPipelineApplicationsRef: ListPipelineApplicationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listPipelineApplicationsRef:
```typescript
const name = listPipelineApplicationsRef.operationName;
console.log(name);
```

### Variables
The `ListPipelineApplications` query requires an argument of type `ListPipelineApplicationsVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListPipelineApplicationsVariables {
  tenantId: UUIDString;
}
```
### Return Type
Recall that executing the `ListPipelineApplications` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListPipelineApplicationsData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListPipelineApplicationsData {
  pipelineApplications: ({
    id: UUIDString;
    opportunity: {
      id: UUIDString;
      title: string;
      agency: string;
      responseDeadline?: TimestampString | null;
    } & Opportunity_Key;
      status: string;
      fitScore?: number | null;
      createdAt: TimestampString;
  } & PipelineApplication_Key)[];
}
```
### Using `ListPipelineApplications`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listPipelineApplications, ListPipelineApplicationsVariables } from '@govcontract/dataconnect';

// The `ListPipelineApplications` query requires an argument of type `ListPipelineApplicationsVariables`:
const listPipelineApplicationsVars: ListPipelineApplicationsVariables = {
  tenantId: ..., 
};

// Call the `listPipelineApplications()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listPipelineApplications(listPipelineApplicationsVars);
// Variables can be defined inline as well.
const { data } = await listPipelineApplications({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listPipelineApplications(dataConnect, listPipelineApplicationsVars);

console.log(data.pipelineApplications);

// Or, you can use the `Promise` API.
listPipelineApplications(listPipelineApplicationsVars).then((response) => {
  const data = response.data;
  console.log(data.pipelineApplications);
});
```

### Using `ListPipelineApplications`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listPipelineApplicationsRef, ListPipelineApplicationsVariables } from '@govcontract/dataconnect';

// The `ListPipelineApplications` query requires an argument of type `ListPipelineApplicationsVariables`:
const listPipelineApplicationsVars: ListPipelineApplicationsVariables = {
  tenantId: ..., 
};

// Call the `listPipelineApplicationsRef()` function to get a reference to the query.
const ref = listPipelineApplicationsRef(listPipelineApplicationsVars);
// Variables can be defined inline as well.
const ref = listPipelineApplicationsRef({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listPipelineApplicationsRef(dataConnect, listPipelineApplicationsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.pipelineApplications);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.pipelineApplications);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreatePipelineApplication
You can execute the `CreatePipelineApplication` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
createPipelineApplication(vars: CreatePipelineApplicationVariables): MutationPromise<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;

interface CreatePipelineApplicationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePipelineApplicationVariables): MutationRef<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
}
export const createPipelineApplicationRef: CreatePipelineApplicationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPipelineApplication(dc: DataConnect, vars: CreatePipelineApplicationVariables): MutationPromise<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;

interface CreatePipelineApplicationRef {
  ...
  (dc: DataConnect, vars: CreatePipelineApplicationVariables): MutationRef<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
}
export const createPipelineApplicationRef: CreatePipelineApplicationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPipelineApplicationRef:
```typescript
const name = createPipelineApplicationRef.operationName;
console.log(name);
```

### Variables
The `CreatePipelineApplication` mutation requires an argument of type `CreatePipelineApplicationVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreatePipelineApplicationVariables {
  tenantId: UUIDString;
  opportunityId: UUIDString;
  status: string;
}
```
### Return Type
Recall that executing the `CreatePipelineApplication` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePipelineApplicationData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePipelineApplicationData {
  pipelineApplication_insert: PipelineApplication_Key;
}
```
### Using `CreatePipelineApplication`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPipelineApplication, CreatePipelineApplicationVariables } from '@govcontract/dataconnect';

// The `CreatePipelineApplication` mutation requires an argument of type `CreatePipelineApplicationVariables`:
const createPipelineApplicationVars: CreatePipelineApplicationVariables = {
  tenantId: ..., 
  opportunityId: ..., 
  status: ..., 
};

// Call the `createPipelineApplication()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPipelineApplication(createPipelineApplicationVars);
// Variables can be defined inline as well.
const { data } = await createPipelineApplication({ tenantId: ..., opportunityId: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPipelineApplication(dataConnect, createPipelineApplicationVars);

console.log(data.pipelineApplication_insert);

// Or, you can use the `Promise` API.
createPipelineApplication(createPipelineApplicationVars).then((response) => {
  const data = response.data;
  console.log(data.pipelineApplication_insert);
});
```

### Using `CreatePipelineApplication`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPipelineApplicationRef, CreatePipelineApplicationVariables } from '@govcontract/dataconnect';

// The `CreatePipelineApplication` mutation requires an argument of type `CreatePipelineApplicationVariables`:
const createPipelineApplicationVars: CreatePipelineApplicationVariables = {
  tenantId: ..., 
  opportunityId: ..., 
  status: ..., 
};

// Call the `createPipelineApplicationRef()` function to get a reference to the mutation.
const ref = createPipelineApplicationRef(createPipelineApplicationVars);
// Variables can be defined inline as well.
const ref = createPipelineApplicationRef({ tenantId: ..., opportunityId: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPipelineApplicationRef(dataConnect, createPipelineApplicationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.pipelineApplication_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.pipelineApplication_insert);
});
```


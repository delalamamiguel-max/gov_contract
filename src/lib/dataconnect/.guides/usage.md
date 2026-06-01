# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createPipelineApplication, listOpportunities, listPipelineApplications } from '@govcontract/dataconnect';


// Operation CreatePipelineApplication:  For variables, look at type CreatePipelineApplicationVars in ../index.d.ts
const { data } = await CreatePipelineApplication(dataConnect, createPipelineApplicationVars);

// Operation ListOpportunities: 
const { data } = await ListOpportunities(dataConnect);

// Operation ListPipelineApplications:  For variables, look at type ListPipelineApplicationsVars in ../index.d.ts
const { data } = await ListPipelineApplications(dataConnect, listPipelineApplicationsVars);


```
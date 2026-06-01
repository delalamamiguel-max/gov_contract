# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { listOpportunities, searchOpportunities, listPipelineApplications, createPipelineApplication, upsertOpportunity, upsertBusinessProfile, updatePipelineApplicationStatus } from '@govcontract/dataconnect';


// Operation ListOpportunities: 
const { data } = await ListOpportunities(dataConnect);

// Operation SearchOpportunities:  For variables, look at type SearchOpportunitiesVars in ../index.d.ts
const { data } = await SearchOpportunities(dataConnect, searchOpportunitiesVars);

// Operation ListPipelineApplications:  For variables, look at type ListPipelineApplicationsVars in ../index.d.ts
const { data } = await ListPipelineApplications(dataConnect, listPipelineApplicationsVars);

// Operation CreatePipelineApplication:  For variables, look at type CreatePipelineApplicationVars in ../index.d.ts
const { data } = await CreatePipelineApplication(dataConnect, createPipelineApplicationVars);

// Operation UpsertOpportunity:  For variables, look at type UpsertOpportunityVars in ../index.d.ts
const { data } = await UpsertOpportunity(dataConnect, upsertOpportunityVars);

// Operation UpsertBusinessProfile:  For variables, look at type UpsertBusinessProfileVars in ../index.d.ts
const { data } = await UpsertBusinessProfile(dataConnect, upsertBusinessProfileVars);

// Operation UpdatePipelineApplicationStatus:  For variables, look at type UpdatePipelineApplicationStatusVars in ../index.d.ts
const { data } = await UpdatePipelineApplicationStatus(dataConnect, updatePipelineApplicationStatusVars);


```
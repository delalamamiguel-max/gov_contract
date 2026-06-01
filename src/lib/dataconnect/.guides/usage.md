# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createPipelineApplication, upsertOpportunity, upsertBusinessProfile, updatePipelineApplicationStatus, updateTenantProStatus, updateTenantTokens, listOpportunities, searchOpportunities, listPipelineApplications, getTenant } from '@govcontract/dataconnect';


// Operation CreatePipelineApplication:  For variables, look at type CreatePipelineApplicationVars in ../index.d.ts
const { data } = await CreatePipelineApplication(dataConnect, createPipelineApplicationVars);

// Operation UpsertOpportunity:  For variables, look at type UpsertOpportunityVars in ../index.d.ts
const { data } = await UpsertOpportunity(dataConnect, upsertOpportunityVars);

// Operation UpsertBusinessProfile:  For variables, look at type UpsertBusinessProfileVars in ../index.d.ts
const { data } = await UpsertBusinessProfile(dataConnect, upsertBusinessProfileVars);

// Operation UpdatePipelineApplicationStatus:  For variables, look at type UpdatePipelineApplicationStatusVars in ../index.d.ts
const { data } = await UpdatePipelineApplicationStatus(dataConnect, updatePipelineApplicationStatusVars);

// Operation UpdateTenantProStatus:  For variables, look at type UpdateTenantProStatusVars in ../index.d.ts
const { data } = await UpdateTenantProStatus(dataConnect, updateTenantProStatusVars);

// Operation UpdateTenantTokens:  For variables, look at type UpdateTenantTokensVars in ../index.d.ts
const { data } = await UpdateTenantTokens(dataConnect, updateTenantTokensVars);

// Operation ListOpportunities: 
const { data } = await ListOpportunities(dataConnect);

// Operation SearchOpportunities:  For variables, look at type SearchOpportunitiesVars in ../index.d.ts
const { data } = await SearchOpportunities(dataConnect, searchOpportunitiesVars);

// Operation ListPipelineApplications:  For variables, look at type ListPipelineApplicationsVars in ../index.d.ts
const { data } = await ListPipelineApplications(dataConnect, listPipelineApplicationsVars);

// Operation GetTenant:  For variables, look at type GetTenantVars in ../index.d.ts
const { data } = await GetTenant(dataConnect, getTenantVars);


```
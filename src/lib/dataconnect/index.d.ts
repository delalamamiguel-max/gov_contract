import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface BusinessProfile_Key {
  tenantId: UUIDString;
  __typename?: 'BusinessProfile_Key';
}

export interface CreatePipelineApplicationData {
  pipelineApplication_insert: PipelineApplication_Key;
}

export interface CreatePipelineApplicationVariables {
  tenantId: UUIDString;
  opportunityId: string;
  status: string;
}

export interface GetTenantData {
  tenant?: {
    id: UUIDString;
    isPro: boolean;
    tokensRemaining: number;
  } & Tenant_Key;
}

export interface GetTenantVariables {
  id: UUIDString;
}

export interface ListOpportunitiesData {
  opportunities: ({
    noticeId: string;
    title: string;
    agency: string;
    description?: string | null;
    solicitationNumber?: string | null;
    naicsCode?: string | null;
    setAsideType?: string | null;
    postedDate: TimestampString;
    responseDeadline?: TimestampString | null;
    estimatedValue?: number | null;
    sourceUrl: string;
  } & Opportunity_Key)[];
}

export interface ListPipelineApplicationsData {
  pipelineApplications: ({
    id: UUIDString;
    opportunity: {
      noticeId: string;
      title: string;
      agency: string;
      responseDeadline?: TimestampString | null;
    } & Opportunity_Key;
      status: string;
      fitScore?: number | null;
      createdAt: TimestampString;
  } & PipelineApplication_Key)[];
}

export interface ListPipelineApplicationsVariables {
  tenantId: UUIDString;
}

export interface Opportunity_Key {
  noticeId: string;
  __typename?: 'Opportunity_Key';
}

export interface PipelineApplication_Key {
  id: UUIDString;
  __typename?: 'PipelineApplication_Key';
}

export interface SearchOpportunitiesData {
  opportunities: ({
    noticeId: string;
    title: string;
    agency: string;
    description?: string | null;
    solicitationNumber?: string | null;
    naicsCode?: string | null;
    setAsideType?: string | null;
    postedDate: TimestampString;
    responseDeadline?: TimestampString | null;
    estimatedValue?: number | null;
    sourceUrl: string;
  } & Opportunity_Key)[];
}

export interface SearchOpportunitiesVariables {
  keyword?: string | null;
}

export interface Tenant_Key {
  id: UUIDString;
  __typename?: 'Tenant_Key';
}

export interface UpdatePipelineApplicationStatusData {
  pipelineApplication_update?: PipelineApplication_Key | null;
}

export interface UpdatePipelineApplicationStatusVariables {
  id: UUIDString;
  status: string;
}

export interface UpdateTenantProStatusData {
  tenant_update?: Tenant_Key | null;
}

export interface UpdateTenantProStatusVariables {
  id: UUIDString;
  isPro: boolean;
  stripeCustomerId?: string | null;
}

export interface UpdateTenantTokensData {
  tenant_update?: Tenant_Key | null;
}

export interface UpdateTenantTokensVariables {
  id: UUIDString;
  tokensRemaining: number;
}

export interface UpsertBusinessProfileData {
  businessProfile_upsert: BusinessProfile_Key;
}

export interface UpsertBusinessProfileVariables {
  tenantId: UUIDString;
  naicsCodes?: string[] | null;
  setAsideTypes?: string[] | null;
  minCapacity?: number | null;
  maxCapacity?: number | null;
}

export interface UpsertOpportunityData {
  opportunity_upsert: Opportunity_Key;
}

export interface UpsertOpportunityVariables {
  noticeId: string;
  title: string;
  agency: string;
  description?: string | null;
  solicitationNumber?: string | null;
  naicsCode?: string | null;
  setAsideType?: string | null;
  postedDate: TimestampString;
  responseDeadline?: TimestampString | null;
  estimatedValue?: number | null;
  sourceUrl: string;
}

export interface User_Key {
  uid: string;
  __typename?: 'User_Key';
}

interface CreatePipelineApplicationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePipelineApplicationVariables): MutationRef<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePipelineApplicationVariables): MutationRef<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
  operationName: string;
}
export const createPipelineApplicationRef: CreatePipelineApplicationRef;

export function createPipelineApplication(vars: CreatePipelineApplicationVariables): MutationPromise<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;
export function createPipelineApplication(dc: DataConnect, vars: CreatePipelineApplicationVariables): MutationPromise<CreatePipelineApplicationData, CreatePipelineApplicationVariables>;

interface UpsertOpportunityRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertOpportunityVariables): MutationRef<UpsertOpportunityData, UpsertOpportunityVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertOpportunityVariables): MutationRef<UpsertOpportunityData, UpsertOpportunityVariables>;
  operationName: string;
}
export const upsertOpportunityRef: UpsertOpportunityRef;

export function upsertOpportunity(vars: UpsertOpportunityVariables): MutationPromise<UpsertOpportunityData, UpsertOpportunityVariables>;
export function upsertOpportunity(dc: DataConnect, vars: UpsertOpportunityVariables): MutationPromise<UpsertOpportunityData, UpsertOpportunityVariables>;

interface UpsertBusinessProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertBusinessProfileVariables): MutationRef<UpsertBusinessProfileData, UpsertBusinessProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertBusinessProfileVariables): MutationRef<UpsertBusinessProfileData, UpsertBusinessProfileVariables>;
  operationName: string;
}
export const upsertBusinessProfileRef: UpsertBusinessProfileRef;

export function upsertBusinessProfile(vars: UpsertBusinessProfileVariables): MutationPromise<UpsertBusinessProfileData, UpsertBusinessProfileVariables>;
export function upsertBusinessProfile(dc: DataConnect, vars: UpsertBusinessProfileVariables): MutationPromise<UpsertBusinessProfileData, UpsertBusinessProfileVariables>;

interface UpdatePipelineApplicationStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdatePipelineApplicationStatusVariables): MutationRef<UpdatePipelineApplicationStatusData, UpdatePipelineApplicationStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdatePipelineApplicationStatusVariables): MutationRef<UpdatePipelineApplicationStatusData, UpdatePipelineApplicationStatusVariables>;
  operationName: string;
}
export const updatePipelineApplicationStatusRef: UpdatePipelineApplicationStatusRef;

export function updatePipelineApplicationStatus(vars: UpdatePipelineApplicationStatusVariables): MutationPromise<UpdatePipelineApplicationStatusData, UpdatePipelineApplicationStatusVariables>;
export function updatePipelineApplicationStatus(dc: DataConnect, vars: UpdatePipelineApplicationStatusVariables): MutationPromise<UpdatePipelineApplicationStatusData, UpdatePipelineApplicationStatusVariables>;

interface UpdateTenantProStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTenantProStatusVariables): MutationRef<UpdateTenantProStatusData, UpdateTenantProStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTenantProStatusVariables): MutationRef<UpdateTenantProStatusData, UpdateTenantProStatusVariables>;
  operationName: string;
}
export const updateTenantProStatusRef: UpdateTenantProStatusRef;

export function updateTenantProStatus(vars: UpdateTenantProStatusVariables): MutationPromise<UpdateTenantProStatusData, UpdateTenantProStatusVariables>;
export function updateTenantProStatus(dc: DataConnect, vars: UpdateTenantProStatusVariables): MutationPromise<UpdateTenantProStatusData, UpdateTenantProStatusVariables>;

interface UpdateTenantTokensRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTenantTokensVariables): MutationRef<UpdateTenantTokensData, UpdateTenantTokensVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTenantTokensVariables): MutationRef<UpdateTenantTokensData, UpdateTenantTokensVariables>;
  operationName: string;
}
export const updateTenantTokensRef: UpdateTenantTokensRef;

export function updateTenantTokens(vars: UpdateTenantTokensVariables): MutationPromise<UpdateTenantTokensData, UpdateTenantTokensVariables>;
export function updateTenantTokens(dc: DataConnect, vars: UpdateTenantTokensVariables): MutationPromise<UpdateTenantTokensData, UpdateTenantTokensVariables>;

interface ListOpportunitiesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListOpportunitiesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListOpportunitiesData, undefined>;
  operationName: string;
}
export const listOpportunitiesRef: ListOpportunitiesRef;

export function listOpportunities(options?: ExecuteQueryOptions): QueryPromise<ListOpportunitiesData, undefined>;
export function listOpportunities(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListOpportunitiesData, undefined>;

interface SearchOpportunitiesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: SearchOpportunitiesVariables): QueryRef<SearchOpportunitiesData, SearchOpportunitiesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: SearchOpportunitiesVariables): QueryRef<SearchOpportunitiesData, SearchOpportunitiesVariables>;
  operationName: string;
}
export const searchOpportunitiesRef: SearchOpportunitiesRef;

export function searchOpportunities(vars?: SearchOpportunitiesVariables, options?: ExecuteQueryOptions): QueryPromise<SearchOpportunitiesData, SearchOpportunitiesVariables>;
export function searchOpportunities(dc: DataConnect, vars?: SearchOpportunitiesVariables, options?: ExecuteQueryOptions): QueryPromise<SearchOpportunitiesData, SearchOpportunitiesVariables>;

interface ListPipelineApplicationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListPipelineApplicationsVariables): QueryRef<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListPipelineApplicationsVariables): QueryRef<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
  operationName: string;
}
export const listPipelineApplicationsRef: ListPipelineApplicationsRef;

export function listPipelineApplications(vars: ListPipelineApplicationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;
export function listPipelineApplications(dc: DataConnect, vars: ListPipelineApplicationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPipelineApplicationsData, ListPipelineApplicationsVariables>;

interface GetTenantRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTenantVariables): QueryRef<GetTenantData, GetTenantVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTenantVariables): QueryRef<GetTenantData, GetTenantVariables>;
  operationName: string;
}
export const getTenantRef: GetTenantRef;

export function getTenant(vars: GetTenantVariables, options?: ExecuteQueryOptions): QueryPromise<GetTenantData, GetTenantVariables>;
export function getTenant(dc: DataConnect, vars: GetTenantVariables, options?: ExecuteQueryOptions): QueryPromise<GetTenantData, GetTenantVariables>;


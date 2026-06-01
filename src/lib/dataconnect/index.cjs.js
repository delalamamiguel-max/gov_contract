const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'default',
  service: 'govcontract-app',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const createPipelineApplicationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePipelineApplication', inputVars);
}
createPipelineApplicationRef.operationName = 'CreatePipelineApplication';
exports.createPipelineApplicationRef = createPipelineApplicationRef;

exports.createPipelineApplication = function createPipelineApplication(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createPipelineApplicationRef(dcInstance, inputVars));
}
;

const upsertOpportunityRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertOpportunity', inputVars);
}
upsertOpportunityRef.operationName = 'UpsertOpportunity';
exports.upsertOpportunityRef = upsertOpportunityRef;

exports.upsertOpportunity = function upsertOpportunity(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertOpportunityRef(dcInstance, inputVars));
}
;

const upsertBusinessProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertBusinessProfile', inputVars);
}
upsertBusinessProfileRef.operationName = 'UpsertBusinessProfile';
exports.upsertBusinessProfileRef = upsertBusinessProfileRef;

exports.upsertBusinessProfile = function upsertBusinessProfile(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertBusinessProfileRef(dcInstance, inputVars));
}
;

const updatePipelineApplicationStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdatePipelineApplicationStatus', inputVars);
}
updatePipelineApplicationStatusRef.operationName = 'UpdatePipelineApplicationStatus';
exports.updatePipelineApplicationStatusRef = updatePipelineApplicationStatusRef;

exports.updatePipelineApplicationStatus = function updatePipelineApplicationStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updatePipelineApplicationStatusRef(dcInstance, inputVars));
}
;

const updateTenantProStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTenantProStatus', inputVars);
}
updateTenantProStatusRef.operationName = 'UpdateTenantProStatus';
exports.updateTenantProStatusRef = updateTenantProStatusRef;

exports.updateTenantProStatus = function updateTenantProStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateTenantProStatusRef(dcInstance, inputVars));
}
;

const updateTenantTokensRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTenantTokens', inputVars);
}
updateTenantTokensRef.operationName = 'UpdateTenantTokens';
exports.updateTenantTokensRef = updateTenantTokensRef;

exports.updateTenantTokens = function updateTenantTokens(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateTenantTokensRef(dcInstance, inputVars));
}
;

const listOpportunitiesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListOpportunities');
}
listOpportunitiesRef.operationName = 'ListOpportunities';
exports.listOpportunitiesRef = listOpportunitiesRef;

exports.listOpportunities = function listOpportunities(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listOpportunitiesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const searchOpportunitiesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'SearchOpportunities', inputVars);
}
searchOpportunitiesRef.operationName = 'SearchOpportunities';
exports.searchOpportunitiesRef = searchOpportunitiesRef;

exports.searchOpportunities = function searchOpportunities(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, false);
  return executeQuery(searchOpportunitiesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listPipelineApplicationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListPipelineApplications', inputVars);
}
listPipelineApplicationsRef.operationName = 'ListPipelineApplications';
exports.listPipelineApplicationsRef = listPipelineApplicationsRef;

exports.listPipelineApplications = function listPipelineApplications(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listPipelineApplicationsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getTenantRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTenant', inputVars);
}
getTenantRef.operationName = 'GetTenant';
exports.getTenantRef = getTenantRef;

exports.getTenant = function getTenant(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getTenantRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

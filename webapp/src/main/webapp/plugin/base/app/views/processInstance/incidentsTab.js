ngDefine('cockpit.plugin.base.views', function(module) {

   function IncidentsController ($scope, $http, search, Uri) {

    // input: processInstance, processData

    var incidentData = $scope.processData.newChild($scope);
    var processInstance = $scope.processInstance;

    var DEFAULT_PAGES = { size: 50, total: 0, current: 1 };

    var pages = $scope.pages = angular.copy(DEFAULT_PAGES);

    var filter = null;

    $scope.$watch('pages.current', function(newValue, oldValue) {
      if (newValue == oldValue) {
        return;
      }

      search('page', !newValue || newValue == 1 ? null : newValue);
    });

    incidentData.observe([ 'filter', 'bpmnElements', 'activityIdToInstancesMap' ], function(newFilter, bpmnElements, activityIdToInstancesMap) {
      pages.current = newFilter.page || 1;

      updateView(newFilter, bpmnElements, activityIdToInstancesMap);
    });

    function updateView (newFilter, bpmnElements, activityIdToInstancesMap) {
      filter = angular.copy(newFilter);

      delete filter.page;
      delete filter.activityInstanceIds;
      delete filter.scrollToBpmnElement;

      var page = pages.current,
          count = pages.size,
          firstResult = (page - 1) * count;

      var defaultParams = {
        processInstanceIdIn: [ processInstance.id ]
      };

      var pagingParams = {
        firstResult: firstResult,
        maxResults: count
      };

      var params = angular.extend({}, filter, defaultParams);

      // fix missmatch -> activityIds -> activityIdIn
      params.activityIdIn = params.activityIds;
      delete params.activityIds;

      $scope.incidents = null;

      // get the 'count' of incidents
      $http.post(Uri.appUri('plugin://base/:engine/incident/count'), params).success(function(data) {
        pages.total = Math.ceil(data.count / pages.size);
      });

      // get the incidents
      $http.post(Uri.appUri('plugin://base/:engine/incident'), params, {params: pagingParams }).success(function(data) { 
        angular.forEach(data, function (incident) {
          var activityId = incident.activityId;
          var bpmnElement = bpmnElements[activityId];
          incident.activityName = bpmnElement.name || bpmnElement.id;
          incident.linkable = bpmnElements[activityId] && activityIdToInstancesMap[activityId].length > 0;
        });

        $scope.incidents = data;
      });
    };    

    $scope.getIncidentType = function (incident) {
      if (incident.incidentType === 'failedJob') {
        return 'Failed Job';
      }

      return incident.incidentType;
    };

    $scope.getJobStacktraceUrl = function (incident) {
      return Uri.appUri('engine://engine/:engine/job/' + incident.rootCauseIncidentConfiguration + '/stacktrace');
    };

  };

  module.controller('IncidentsController', [ '$scope', '$http', 'search', 'Uri', IncidentsController ]);

  var Configuration = function PluginConfiguration(ViewsProvider) {

    ViewsProvider.registerDefaultView('cockpit.processInstance.instanceDetails', {
      id: 'incidents-tab',
      label: 'Incidents',
      url: 'plugin://base/static/app/views/processInstance/incidents-tab.html',
      controller: 'IncidentsController',
      priority: 15
    });
  };

  Configuration.$inject = ['ViewsProvider'];

  module.config(Configuration);
});

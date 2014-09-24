/* global ngDefine: false, angular: false */
ngDefine('cockpit.plugin.base.views', function(module) {
  'use strict';

  module.controller('VariableInstanceInspectController', [
          '$scope', '$location', '$http', 'Notifications', '$modalInstance', 'Uri', 'variableInstance',
  function($scope,   $location,   $http,   Notifications,   $modalInstance,   Uri,   variableInstance) {

    var BEFORE_CHANGE = 'beforeChange',
        CONFIRM_CHANGE = 'confirmChange',
        CHANGE_SUCCESS = 'changeSuccess';

    var isSpinSerializable = variableInstance.type === 'Object';

    $scope.variableInstance = variableInstance;
    $scope.status = BEFORE_CHANGE;

    if(isSpinSerializable) {
      $scope.initialValue = variableInstance.value;
      $scope.objectType = variableInstance.serializationConfig.rootType;
    } else {
      $scope.initialValue = JSON.stringify(variableInstance.value.object, null, 2);
      $scope.objectType = variableInstance.value.type;
    }
    $scope.currentValue = $scope.initialValue;

    $scope.confirmed = false;

    function uploadComplete(parsedValue) {
      var self = $scope.xhr;
      $scope.$apply(function(){
        if(self.status == 204) {
          $scope.status = CHANGE_SUCCESS;

          Notifications.addMessage({
            status: 'Success',
            message: 'Successfully updated the variable.'
          });

          angular.extend(variableInstance, {
            type: variableInstance.type,
            value: {
              type: variableInstance.value.type,
              object : parsedValue
            }
          });
        }
        else {
          $scope.status = BEFORE_CHANGE;

          Notifications.addError({
            status: 'Failed',
            message: 'Could not update variable: '+self.responseText,
            exclusive: ['type']
          });
        }
        // cleanup
        delete $scope.xhr;
      });
    }

    $scope.typeIn = function(formScope) {
      $scope.currentValue = formScope.currentValue;

      if ($scope.hasChanged()) {
        $scope.status = CONFIRM_CHANGE;
      }
      else {
        $scope.status = BEFORE_CHANGE;
      }
    };

    $scope.hasChanged = function() {
      return $scope.initialValue != $scope.currentValue;
    };

    $scope.change = function () {
      if($scope.status == BEFORE_CHANGE) {
        $scope.status = CONFIRM_CHANGE;
      }
      else {
        var newValue = $scope.currentValue;
        var parsedValue;

        if(!isSpinSerializable || variableInstance.serializationConfig.dataFormatId.indexOf("application/json") >= 0) {
          try {
            // check whether the user provided valid JSON.
            parsedValue = JSON.parse(newValue);
          } catch(e) {
            $scope.status = BEFORE_CHANGE;
            Notifications.addError({
              status: 'Variable',
              message: 'Could not parse JSON input: '+e,
              exclusive: true
            });
            return;
          }
        }

        if(isSpinSerializable) {
          // do PUT
          var variableUpdate = {
            value: newValue,
            type: variableInstance.type,
            variableType: variableInstance.variableType,
            serializationConfig: variableInstance.serializationConfig
          };

          $http({method: 'PUT', url: $scope.getObjectVariablePutUrl(), data: variableUpdate})
            .success(function(data, status, headers, config) {
              $scope.status = CHANGE_SUCCESS;

              Notifications.addMessage({
                status: 'Success',
                message: 'Successfully updated the variable.'
              });

              angular.extend(variableInstance, {
                type: variableInstance.type,
                value: newValue
              });
            })
            .error(function(data, status, headers, config) {
              $scope.status = BEFORE_CHANGE;

              Notifications.addError({
                status: 'Failed',
                message: 'Could not update variable: '+data,
                exclusive: ['type']
              });
            });

        } else {
          // create HTML 5 form upload
          var fd = new FormData();
          fd.append('data', new Blob([$scope.currentValue], {type : 'application/json'}));
          fd.append('type', variableInstance.value.type);

          var xhr = $scope.xhr = new XMLHttpRequest();
          xhr.addEventListener('load', function() {
            uploadComplete(parsedValue);
          }, false);
          xhr.open('POST', $scope.getSerializableVariableUploadUrl());
          xhr.send(fd);
        }
      }

    };

    $scope.getSerializableVariableUploadUrl = function () {
      return Uri.appUri('engine://engine/:engine/execution/'+variableInstance.executionId+'/localVariables/'+variableInstance.name+'/data');
    };

    $scope.getObjectVariablePutUrl = function () {
      return Uri.appUri('engine://engine/:engine/execution/'+variableInstance.executionId+'/localVariables/'+variableInstance.name);
    };

    $scope.$on('$routeChangeStart', function () {
      $modalInstance.close($scope.status);
    });

    $scope.close = function (status) {
      $modalInstance.close(status);
    };
  }]);
});

angular.module('schemaForm').directive('schemaValidate', ['sfValidator', 'sfSelect', function(sfValidator, sfSelect) {

  return {
    restrict: 'A',
    scope: false,
    // We want the link function to be *after* the input directives link function so we get access
    // the parsed value, ex. a number instead of a string
    priority: 500,
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {


      // We need the ngModelController on several places,
      // most notably for errors.
      // So we emit it up to the decorator directive so it can put it on scope.
      scope.$emit('schemaFormPropagateNgModelController', ngModel);

      var error = null;

      var getForm = function() {
        if (!form) {
          form = scope.$eval(attrs.schemaValidate);
        }
        return form;
      };
      var form   = getForm();
      if (form.copyValueTo) {
        ngModel.$viewChangeListeners.push(function() {
          var paths = form.copyValueTo;
          angular.forEach(paths, function(path) {
            sfSelect(path, scope.model, ngModel.$modelValue);
          });
        });
      }

      // Validate against the schema.

      var validate = function(viewValue) {
        form = getForm();
        //Still might be undefined
        if (!form) {
          return viewValue;
        }

        var result =  sfValidator.validate(form, viewValue);
        // Since we might have different tv4 errors we must clear all
        // errors that start with tv4-
        Object.keys(ngModel.$error)
              //.filter(function(k) { return k.indexOf('tv4-') === 0; })
              .forEach(function(k) { ngModel.$setValidity(k, true); });

        if (!result.valid) {
          // it is invalid, return undefined (no model update)
          ngModel.$setValidity('tv4-' + result.error.code, false);
          error = result.error;
          return undefined;
        }
        return viewValue;
      };

      // Custom validators, parsers, formatters etc
      if (typeof form.ngModel === 'function') {
        form.ngModel(ngModel);
      }

      ['$parsers', '$viewChangeListeners', '$formatters'].forEach(function(attr) {
        if (form[attr] && ngModel[attr]) {
          form[attr].forEach(function(fn) {
            ngModel[attr].push(fn);
          });
        }
      });

      ['$validators', '$asyncValidators'].forEach(function(attr) {
        // Check if our version of angular has i, i.e. 1.3+
        if (form[attr] && ngModel[attr]) {
          angular.forEach(form[attr], function(fn, name) {
            ngModel[attr][name] = fn;
          });
        }
      });

      // Get in last of the parses so the parsed value has the correct type.
      // We don't use $validators since we like to set different errors depeding tv4 error codes
      ngModel.$parsers.push(validate);

      //is require validate
      // In Angular 1.3 setting undefined as a viewValue does not trigger parsers
      var isRequireValidate = function(viewValue) {
        var form = getForm();
        if (!form) {
          return viewValue;
        }
        if (form.required && ngModel.$isEmpty(ngModel.$modelValue)) {
            ngModel.$setValidity('302', false);
          } else {
            ngModel.$setValidity('302', true);
          }
      };
      ngModel.$parsers.push(isRequireValidate);

      // Listen to an event so we can validate the input on request
      scope.$on('schemaFormValidate', function() {
        // We set the viewValue to trigger parsers,
          // since modelValue might be empty and validating just that
          // might change an existing error to a "required" error message.
          if (ngModel.$setDirty) {

            // Angular 1.3+
            ngModel.$setDirty();
            ngModel.$setViewValue(ngModel.$viewValue);
            ngModel.$commitViewValue();

          } else {
            // Angular 1.2
            // In angular 1.2 setting a viewValue of undefined will trigger the parser.
            // hence required works.
            ngModel.$setViewValue(ngModel.$viewValue);
          }
      });

      scope.$on('schemaFormResetValidationFeedback', function() {
        scope.$apply(function() {
          for(var errorKey in ngModel.$error){
            if(ngModel.$error.hasOwnProperty(errorKey)){
              ngModel.$setValidity(errorKey, true);
            }
          }
          error = null;
        });
      });

      scope.schemaError = function() {
        return error;
      };

    }
  };
}]);

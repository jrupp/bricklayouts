import { DataTypes, CurrentFormatVersion, SerializedLayout } from "../controller/layoutController.js";
import { SerializedComponent } from "../model/component.js";
import { isApproxMultiple } from "./utils.js";

/**
 * Upgrades the layout data to the current format version.
 * @param {SerializedLayout} data The layout data to upgrade. Changes will be made in-place.
 */
export function upgradeLayout(data) {
  if (!data || data?.version === CurrentFormatVersion) {
    return data;
  }

  // Perform upgrade steps based on the current version
  switch (data.version) {
    case 1:
      // Upgrade from version 1 to 2
      upgradeFromV1ToV2(data);
      break;
    // Add more cases as needed for future versions
  }

  data.version = CurrentFormatVersion;
}

/**
 * Upgrades the layout data from version 1 to version 2.
 * @param {SerializedLayout} data The layout data to upgrade.
 */
function upgradeFromV1ToV2(data) {
  data?.layers?.forEach((layer) => {
    layer?.components?.forEach(/** @param {SerializedComponent} component */(component) => {
      if (component.units === undefined && (component.type === DataTypes.SHAPE || component.type === DataTypes.BASEPLATE)) {
        if (component.type === DataTypes.SHAPE && component.width !== undefined && component.height !== undefined) {
          if (isApproxMultiple(component.width, 16) && isApproxMultiple(component.height, 16)) {
            component.units = 'studs';
          } else if (isApproxMultiple(component.width, 20) && isApproxMultiple(component.height, 20)) {
            component.units = 'centimeters';
          } else if (isApproxMultiple(component.width, 2) && isApproxMultiple(component.height, 2)) {
            component.units = 'millimeters';
          } else if (isApproxMultiple(component.width, 614.4) && isApproxMultiple(component.height, 614.4)) {
            component.units = 'feet';
          } else if (isApproxMultiple(component.width, 51.2) && isApproxMultiple(component.height, 51.2)) {
            component.units = 'inches';
          } else {
            component.units = 'millimeters';
          }
        } else if (component.type === DataTypes.BASEPLATE) {
          component.units = 'studs';
        }
      }
    });
  });
}

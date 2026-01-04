import { LayoutController } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { ComponentGroup } from "../../src/model/componentGroup.js";
import { Connection } from "../../src/model/connection.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { PolarVector } from "../../src/model/polarVector.js";
import { Container } from '../../src/pixi.mjs';

describe("Select Connected", function() {
  let layoutController;
  let currentLayer;
  
  beforeAll(function() {
    window.RBush = class RBush {
      constructor() {
      }
    };
    spyOn(window, 'RBush').and.returnValue(jasmine.createSpyObj("RBush", ["insert", "remove", "clear", "search"]));
  });
  
  beforeEach(function() {
    // Create real LayoutLayer instances
    currentLayer = new LayoutLayer();
    
    // Create a mock layout controller with minimal setup
    layoutController = {
      hideFileMenu: jasmine.createSpy('hideFileMenu'),
      _showSelectionToolbar: jasmine.createSpy('_showSelectionToolbar'),
      _positionSelectionToolbar: jasmine.createSpy('_positionSelectionToolbar'),
      currentLayer: currentLayer,
      processSelectionBoxResults: LayoutController.prototype.processSelectionBoxResults,
      selectConnected: LayoutController.prototype.selectConnected
    };
    
    // Mock the static LayoutController.selectComponent and selectedComponent
    spyOn(LayoutController, 'selectComponent');
    LayoutController.selectedComponent = null;
  });
  
  afterEach(function() {
    // Clean up static state to prevent test interference
    LayoutController.selectedComponent = null;
  });
  
  // Helper function to create a mock component that can be added to a layer
  function createMockComponent() {
    const mockComponent = new Container();
    Object.setPrototypeOf(mockComponent, Component.prototype);
    mockComponent.connections = new Map();
    // Add sprite property required by Connection
    mockComponent.sprite = { rotation: 0 };
    // Add layer property required by Connection
    mockComponent.layer = currentLayer;
    // Add addChild method to support connections
    const originalAddChild = mockComponent.addChild.bind(mockComponent);
    mockComponent.addChild = function(...args) {
      return originalAddChild(...args);
    };
    // Mock the uuid property using a private field simulation
    const uuid = crypto.randomUUID();
    Object.defineProperty(mockComponent, 'uuid', {
      get: function() { return uuid; },
      enumerable: false,
      configurable: true
    });
    return mockComponent;
  }

  // Helper function to create a connection
  function createConnection(component, index = 0) {
    const offsetVector = new PolarVector(10, 0, 0);
    const connection = new Connection(component, offsetVector, 1, index, index + 1);
    component.connections.set(connection.uuid, connection);
    return connection;
  }

  describe("selectConnected method", function() {
    it("should do nothing when no component is selected", function() {
      LayoutController.selectedComponent = null;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).not.toHaveBeenCalled();
    });

    it("should do nothing when selected component has no connections", function() {
      const mockComponent = createMockComponent();
      currentLayer.addChild(mockComponent);
      LayoutController.selectedComponent = mockComponent;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).not.toHaveBeenCalled();
    });

    it("should do nothing when all connections are unconnected", function() {
      const mockComponent = createMockComponent();
      currentLayer.addChild(mockComponent);
      createConnection(mockComponent, 0);
      createConnection(mockComponent, 1);
      LayoutController.selectedComponent = mockComponent;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).not.toHaveBeenCalled();
    });

    it("should select two connected components in a linear chain", function() {
      const comp1 = createMockComponent();
      const comp2 = createMockComponent();
      currentLayer.addChild(comp1);
      currentLayer.addChild(comp2);
      
      const conn1 = createConnection(comp1, 0);
      const conn2 = createConnection(comp2, 0);
      conn1.connectTo(conn2);
      
      LayoutController.selectedComponent = comp1;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(comp2);
    });

    it("should select three connected components in a linear chain", function() {
      const comp1 = createMockComponent();
      const comp2 = createMockComponent();
      const comp3 = createMockComponent();
      currentLayer.addChild(comp1);
      currentLayer.addChild(comp2);
      currentLayer.addChild(comp3);
      
      const conn1 = createConnection(comp1, 0);
      const conn2 = createConnection(comp2, 0);
      const conn3 = createConnection(comp2, 1);
      const conn4 = createConnection(comp3, 0);
      conn1.connectTo(conn2);
      conn3.connectTo(conn4);
      
      LayoutController.selectedComponent = comp1;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(3);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(comp2);
      expect(selectedArg.components).toContain(comp3);
    });

    it("should handle circular connections without infinite loop", function() {
      const comp1 = createMockComponent();
      const comp2 = createMockComponent();
      const comp3 = createMockComponent();
      currentLayer.addChild(comp1);
      currentLayer.addChild(comp2);
      currentLayer.addChild(comp3);
      
      // Create a circular connection: comp1 -> comp2 -> comp3 -> comp1
      const conn1 = createConnection(comp1, 0);
      const conn2 = createConnection(comp2, 0);
      const conn3 = createConnection(comp2, 1);
      const conn4 = createConnection(comp3, 0);
      const conn5 = createConnection(comp3, 1);
      const conn6 = createConnection(comp1, 1);
      
      conn1.connectTo(conn2);
      conn3.connectTo(conn4);
      conn5.connectTo(conn6);
      
      LayoutController.selectedComponent = comp1;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(3);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(comp2);
      expect(selectedArg.components).toContain(comp3);
    });

    it("should only select connected components, not disconnected ones", function() {
      const comp1 = createMockComponent();
      const comp2 = createMockComponent();
      const comp3 = createMockComponent();
      const comp4 = createMockComponent();
      currentLayer.addChild(comp1);
      currentLayer.addChild(comp2);
      currentLayer.addChild(comp3);
      currentLayer.addChild(comp4);
      
      // Connect comp1 and comp2
      const conn1 = createConnection(comp1, 0);
      const conn2 = createConnection(comp2, 0);
      conn1.connectTo(conn2);
      
      // Connect comp3 and comp4 (separate from comp1-comp2)
      const conn3 = createConnection(comp3, 0);
      const conn4 = createConnection(comp4, 0);
      conn3.connectTo(conn4);
      
      LayoutController.selectedComponent = comp1;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(comp2);
      expect(selectedArg.components).not.toContain(comp3);
      expect(selectedArg.components).not.toContain(comp4);
    });

    it("should handle permanent groups as whole units", function() {
      const comp1 = createMockComponent();
      const groupedComp1 = createMockComponent();
      const groupedComp2 = createMockComponent();
      
      currentLayer.addChild(comp1);
      currentLayer.addChild(groupedComp1);
      currentLayer.addChild(groupedComp2);
      
      // Create a permanent group
      const permanentGroup = new ComponentGroup(false);
      permanentGroup.addComponent(groupedComp1);
      permanentGroup.addComponent(groupedComp2);
      
      // Connect comp1 to a component in the permanent group
      const conn1 = createConnection(comp1, 0);
      const conn2 = createConnection(groupedComp1, 0);
      conn1.connectTo(conn2);
      // Manually update group's connections since connection was created after adding component
      permanentGroup.connections.set(conn2.uuid, conn2);
      
      LayoutController.selectedComponent = comp1;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(permanentGroup);
    });

    it("should follow external connections from permanent groups", function() {
      const comp1 = createMockComponent();
      const groupedComp1 = createMockComponent();
      const groupedComp2 = createMockComponent();
      const comp2 = createMockComponent();
      
      currentLayer.addChild(comp1);
      currentLayer.addChild(groupedComp1);
      currentLayer.addChild(groupedComp2);
      currentLayer.addChild(comp2);
      
      // Create a permanent group
      const permanentGroup = new ComponentGroup(false);
      permanentGroup.addComponent(groupedComp1);
      permanentGroup.addComponent(groupedComp2);
      
      // Connect comp1 to the permanent group
      const conn1 = createConnection(comp1, 0);
      const conn2 = createConnection(groupedComp1, 0);
      conn1.connectTo(conn2);
      // Manually update group's connections since connection was created after adding component
      permanentGroup.connections.set(conn2.uuid, conn2);
      
      // Connect the permanent group to comp2 (external connection)
      const conn3 = createConnection(groupedComp2, 0);
      const conn4 = createConnection(comp2, 0);
      conn3.connectTo(conn4);
      // Manually update group's connections since connection was created after adding component
      permanentGroup.connections.set(conn3.uuid, conn3);
      
      LayoutController.selectedComponent = comp1;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(3);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(permanentGroup);
      expect(selectedArg.components).toContain(comp2);
    });

    it("should work when a temporary group is selected", function() {
      const comp1 = createMockComponent();
      const comp2 = createMockComponent();
      const comp3 = createMockComponent();
      
      currentLayer.addChild(comp1);
      currentLayer.addChild(comp2);
      currentLayer.addChild(comp3);
      
      // Create a temporary group with comp1 and comp2
      const tempGroup = new ComponentGroup(true);
      tempGroup.addComponent(comp1);
      tempGroup.addComponent(comp2);
      
      // Connect comp2 to comp3
      const conn1 = createConnection(comp2, 0);
      const conn2 = createConnection(comp3, 0);
      conn1.connectTo(conn2);
      // Manually update group's connections since connection was created after adding component
      tempGroup.connections.set(conn1.uuid, conn1);
      
      LayoutController.selectedComponent = tempGroup;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(3);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(comp2);
      expect(selectedArg.components).toContain(comp3);
    });

    it("should work when a permanent group is selected", function() {
      const groupedComp1 = createMockComponent();
      const groupedComp2 = createMockComponent();
      const comp1 = createMockComponent();
      
      currentLayer.addChild(groupedComp1);
      currentLayer.addChild(groupedComp2);
      currentLayer.addChild(comp1);
      
      // Create a permanent group
      const permanentGroup = new ComponentGroup(false);
      permanentGroup.addComponent(groupedComp1);
      permanentGroup.addComponent(groupedComp2);
      
      // Connect the permanent group to comp1
      const conn1 = createConnection(groupedComp1, 0);
      const conn2 = createConnection(comp1, 0);
      conn1.connectTo(conn2);
      // Manually update group's connections since connection was created after adding component
      permanentGroup.connections.set(conn1.uuid, conn1);
      
      LayoutController.selectedComponent = permanentGroup;
      
      layoutController.selectConnected();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(permanentGroup);
      expect(selectedArg.components).toContain(comp1);
    });
  });
});

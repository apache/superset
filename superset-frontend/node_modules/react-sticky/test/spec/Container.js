import React from "react";
import { expect } from "chai";
import { mount } from "enzyme";
import { StickyContainer } from "../../src";

const attachTo = document.getElementById("mount");

describe("StickyContainer", () => {
  let container, containerNode;
  beforeEach(() => {
    container = mount(<StickyContainer />, { attachTo });
    containerNode = container.node;
  });

  describe("getChildContext", () => {
    let childContext;
    beforeEach(() => {
      childContext = containerNode.getChildContext();
    });

    it("should expose a subscribe function that adds a callback to the subscriber list", () => {
      expect(childContext.subscribe).to.be.a("function");

      const callback = () => ({});
      expect(containerNode.subscribers).to.be.empty;
      childContext.subscribe(callback);
      expect(containerNode.subscribers[0]).to.equal(callback);
    });

    it("should expose an unsubscribe function that removes a callback from the subscriber list", () => {
      expect(childContext.unsubscribe).to.be.a("function");

      const callback = () => ({});
      childContext.subscribe(callback);
      expect(containerNode.subscribers[0]).to.equal(callback);
      childContext.unsubscribe(callback);
      expect(containerNode.subscribers).to.be.empty;
    });

    it("should expose a getParent function that returns the container's underlying DOM ref", () => {
      expect(childContext.getParent).to.be.a("function");
      expect(childContext.getParent()).to.equal(containerNode.node);
    });
  });

  describe("subscribers", () => {
    let subscribe;
    beforeEach(() => {
      subscribe = containerNode.getChildContext().subscribe;
    });

    // container events
    ["scroll", "touchstart", "touchmove", "touchend"].forEach(eventName => {
      it(`should be notified on container ${eventName} event`, done => {
        expect(containerNode.subscribers).to.be.empty;
        subscribe(() => done());
        container.simulate(eventName);
      });
    });

    // window events
    [
      "resize",
      "scroll",
      "touchstart",
      "touchmove",
      "touchend",
      "pageshow",
      "load"
    ].forEach(eventName => {
      it(`should be notified on window ${eventName} event`, done => {
        expect(containerNode.subscribers).to.be.empty;
        subscribe(() => done());
        window.dispatchEvent(new Event(eventName));
      });
    });
  });

  describe("notifySubscribers", () => {
    it("should publish document.body as eventSource to subscribers when window event", done => {
      containerNode.subscribers = [
        ({ eventSource }) => (
          expect(eventSource).to.equal(document.body), done()
        )
      ];
      containerNode.notifySubscribers({ currentTarget: window });
    });

    it("should publish node as eventSource to subscribers when div event", done => {
      containerNode.subscribers = [
        ({ eventSource }) => (
          expect(eventSource).to.equal(containerNode.node), done()
        )
      ];
      containerNode.notifySubscribers({ currentTarget: containerNode.node });
    });

    it("should publish node top and bottom to subscribers", done => {
      containerNode.subscribers = [
        ({ distanceFromTop, distanceFromBottom }) => {
          expect(distanceFromTop).to.equal(100);
          expect(distanceFromBottom).to.equal(200);
          done();
        }
      ];

      containerNode.node.getBoundingClientRect = () => ({
        top: 100,
        bottom: 200
      });
      containerNode.notifySubscribers({ currentTarget: window });
    });
  });
});

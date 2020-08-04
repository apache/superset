"use strict";

var Benchmark = require("benchmark");
var deepEqual = require("./deep-equal");

var suite = new Benchmark.Suite();
var complex1 = {
    "1e116061-59bf-433a-8ab0-017b67a51d26":
        "a7fd22ab-e809-414f-ad55-9c97598395d8",
    "3824e8b7-22f5-489c-9919-43b432e3af6b":
        "548baefd-f43c-4dc9-9df5-f7c9c96223b0",
    "123e5750-eb66-45e5-a770-310879203b33":
        "89ff817d-65a2-4598-b190-21c128096e6a",
    "1d66be95-8aaa-4167-9a47-e7ee19bb0735":
        "64349492-56e8-4100-9552-a89fb4a9aef4",
    "f5538565-dc92-4ee4-a762-1ba5fe0528f6": {
        "53631f78-2f2a-448f-89c7-ed3585e8e6f0":
            "2cce00ee-f5ee-43ef-878f-958597b23225",
        "73e8298b-72fd-4969-afc1-d891b61e744f":
            "4e57aa30-af51-4d78-887c-019755e5d117",
        "85439907-5b0e-4a08-8cfa-902a68dc3cc0":
            "9639add9-6897-4cf0-b3d3-2ebf9c214f01",
        "d4ae9d87-bd6c-47e0-95a1-6f4eb4211549":
            "41fd3dd2-43ce-47f2-b92e-462474d07a6f",
        "f70345a2-0ea3-45a6-bafa-8c7a72379277": {
            "1bce714b-cd0a-417d-9a0c-bf4b7d35c0c4":
                "3b8b0dde-e2ed-4b34-ac8d-729ba3c9667e",
            "13e05c60-97d1-43f0-a6ef-d5247f4dd11f":
                "60f685a4-6558-4ade-9d4b-28281c3989db",
            "925b2609-e7b7-42f5-82cf-2d995697cec5":
                "79115261-8161-4a6c-9487-47847276a717",
            "52d644ac-7b33-4b79-b5b3-5afe7fd4ec2c": [
                "3c2ae716-92f1-4a3d-b98f-50ea49f51c45",
                "de76b822-71b3-4b5a-a041-4140378b70e2",
                "0302a405-1d58-44fa-a0c6-dd07bb0ca26e",
                new Date(),
                new Error(),
                new RegExp(),
                // eslint-disable-next-line no-undef
                new Map(),
                new Set(),
                // eslint-disable-next-line no-undef, ie11/no-weak-collections
                new WeakMap(),
                // eslint-disable-next-line no-undef, ie11/no-weak-collections
                new WeakSet()
            ]
        }
    }
};
var complex2 = Object.create(complex1);

var cyclic1 = {
    "4a092cd1-225e-4739-8331-d6564aafb702":
        "d0cebbe0-23fb-4cc4-8fa0-ef11ceedf12e"
};
cyclic1.cyclicRef = cyclic1;

var cyclic2 = Object.create(cyclic1);

// add tests
suite
    .add("complex objects", function() {
        return deepEqual(complex1, complex2);
    })
    .add("cyclic references", function() {
        return deepEqual(cyclic1, cyclic2);
    })
    // add listeners
    .on("cycle", function(event) {
        // eslint-disable-next-line no-console
        console.log(String(event.target));
    })
    // run async
    .run({ async: true });

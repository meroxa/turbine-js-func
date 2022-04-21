import path from "path";
import { Record } from "./record";

export default function startServer(
  functionAddress: string,
  functionName: string,
  pathToDataApp: string
) {
  const DataApp = require(pathToDataApp).App;

  function processFunction(call: any, callback: any) {
    const dataApp = new DataApp();
    const inputRecords = call.request.records.map((record: any) => {
      return new Record(record);
    });

    const dataAppFunction = dataApp[functionName];

    const outputRecords = dataAppFunction(inputRecords);

    const records = outputRecords.map((record: any) => {
      return record.serialize();
    });

    callback(null, {
      records,
    });
  }

  const grpc = require("@grpc/grpc-js");
  const protoLoader = require("@grpc/proto-loader");
  const packageDefinition = protoLoader.loadSync(
    path.join(__dirname, "proto/service.proto"),
    {
      keepCase: true,
      defaults: true,
    }
  );

  const serviceProto =
    grpc.loadPackageDefinition(packageDefinition).io.meroxa.funtime;

  const server = new grpc.Server();
  const health = require("grpc-js-health-check");

  const statusMap = {
    function: health.servingStatus.SERVING,
  };

  const healthImpl = new health.Implementation(statusMap);

  server.addService(serviceProto.Function.service, {
    process: processFunction,
  });
  server.addService(health.service, healthImpl);

  server.bindAsync(
    functionAddress,
    grpc.ServerCredentials.createInsecure(),
    () => {
      server.start();
      console.log(`gRPC server started at ${functionAddress}`);
    }
  );
}

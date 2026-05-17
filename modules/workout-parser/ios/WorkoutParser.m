#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WorkoutParser, NSObject)

RCT_EXTERN_METHOD(extractText:(NSString *)imageUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(parseWorkoutText:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

#import <QuickLook/QuickLook.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

// Quick Look preview for .flickgame files: the game's first picture.
// The app writes that picture into the file as a comment when it exports (see flickgame_share.js).
// Objective-C on purpose: the Swift QuickLook overlay library is not present on every iOS version.
@interface PreviewProvider : QLPreviewProvider <QLPreviewingController>
@end

@implementation PreviewProvider

- (void)providePreviewForFileRequest:(QLFilePreviewRequest *)request
                   completionHandler:(void (^)(QLPreviewReply * _Nullable, NSError * _Nullable))handler {
    NSError *error = nil;
    NSString *text = [NSString stringWithContentsOfURL:request.fileURL encoding:NSUTF8StringEncoding error:&error];
    UIImage *picture = nil;
    if (text) {
        NSRange start = [text rangeOfString:@"<!--flickgame-preview:data:image/png;base64,"];
        if (start.location != NSNotFound) {
            NSUInteger from = NSMaxRange(start);
            NSRange end = [text rangeOfString:@"-->" options:0 range:NSMakeRange(from, text.length - from)];
            if (end.location != NSNotFound) {
                NSString *base64 = [text substringWithRange:NSMakeRange(from, end.location - from)];
                NSData *png = [[NSData alloc] initWithBase64EncodedString:base64 options:0];
                if (png) picture = [UIImage imageWithData:png];
            }
        }
    }
    if (!picture || picture.size.width <= 0) {
        handler(nil, error ?: [NSError errorWithDomain:NSCocoaErrorDomain code:NSFileReadCorruptFileError userInfo:nil]);
        return;
    }

    // Scale the pixel art up without smoothing so it stays crisp.
    CGFloat factor = MAX(1, floor(1200 / picture.size.width));
    CGSize size = CGSizeMake(picture.size.width * factor, picture.size.height * factor);
    UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
    format.scale = 1;
    format.opaque = YES;
    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:size format:format];
    NSData *data = [renderer PNGDataWithActions:^(UIGraphicsImageRendererContext *context) {
        CGContextSetInterpolationQuality(context.CGContext, kCGInterpolationNone);
        [picture drawInRect:CGRectMake(0, 0, size.width, size.height)];
    }];
    QLPreviewReply *reply = [[QLPreviewReply alloc] initWithDataOfContentType:UTTypePNG
                                                                  contentSize:size
                                                            dataCreationBlock:^NSData * _Nullable(QLPreviewReply *r, NSError **e) {
        return data;
    }];
    handler(reply, nil);
}

@end
